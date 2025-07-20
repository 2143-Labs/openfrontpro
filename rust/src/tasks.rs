#![allow(clippy::all)]

use anyhow::Context;
use serde_json;
use sqlx::PgPool;
use std::{sync::Arc, time::Duration};

use crate::{
    AnalysisQueueStatus, Config, GameConfig, OpenFrontAPI, PlayerTeams,
    api::{Lobby, PublicLobbiesResponse},
    database::now_unix_sec,
};

pub async fn get_new_games(ofapi: &impl OpenFrontAPI, cfg: &Config) -> anyhow::Result<Vec<Lobby>> {
    let new_games = ofapi.get_lobbies().await?;
    Ok(new_games.lobbies)
}

#[derive(
    Debug, Clone, serde::Deserialize, serde::Serialize, schemars::JsonSchema, PartialEq, Eq,
)]
pub enum GameStatus {
    Finished(serde_json::Value),
    Error(serde_json::Value),
    NotFound,
}

pub async fn look_for_new_games(
    ofapi: impl OpenFrontAPI,
    database: PgPool,
    cfg: std::sync::Arc<Config>,
) -> anyhow::Result<()> {
    let mut expected_to_be_new_game_next_check = true;
    let mut last_game_id = String::new();
    loop {
        let new_games = get_new_games(&ofapi, &*cfg).await?;
        let first = new_games.first().context("No new games found...")?;

        if first.game_id != last_game_id {
            tracing::info!(
                expected_to_be_new_game_next_check,
                "New game found: {}",
                first.game_id
            );
            if !expected_to_be_new_game_next_check {
                // We got a new game earlier than expected. The last one must have been full.
                sqlx::query!(
                    "UPDATE lobbies SET approx_num_players = max_players WHERE game_id = $1",
                    last_game_id
                )
                .execute(&database)
                .await?;
            }
            last_game_id = first.game_id.clone();
        }

        let player_teams_as_int: i32 = first.game_config.player_teams().into();

        sqlx::query!(
            "INSERT INTO
                lobbies (game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec, lobby_config_json)
            VALUES
                ($1, $2, $3, $4, $5, $6, $6, $7)
            ON CONFLICT (game_id)
            DO UPDATE
                SET approx_num_players = $5
                , last_seen_unix_sec = $6
            ",
            first.game_id,
            player_teams_as_int,
            first.game_config.max_players,
            first.game_config.game_map,
            first.num_clients,
            now_unix_sec(),
            serde_json::to_value(&first.game_config).unwrap()
        ).execute(&database).await?;

        let num_players_left = (first.game_config.max_players - first.num_clients).max(0);

        // Wait between 3 and 15 seconds before checking again.
        let next_time = (first.ms_until_start)
            .min(15500)
            .min(num_players_left as u64 * 1000)
            .max(3500)
            - 500;

        expected_to_be_new_game_next_check = next_time > first.ms_until_start;

        tracing::info!(
            "Lobby {} {} ({}) has {}/{} players. Starts in {}ms. Next check in {}ms.",
            first.game_id,
            first.game_config.game_map,
            first.game_config.player_teams(),
            first.num_clients,
            first.game_config.max_players,
            first.ms_until_start,
            next_time
        );
        tokio::time::sleep(tokio::time::Duration::from_millis(next_time)).await;
    }
}

pub async fn check_if_game_finished(
    ofapi: impl OpenFrontAPI,
    game_id: &str,
) -> anyhow::Result<GameStatus> {
    let finished = ofapi.get_game_json(game_id).await?;

    if finished.get("error").is_some() {
        if finished["error"] == "Not found" {
            return Ok(GameStatus::NotFound);
        }

        return Ok(GameStatus::Error(finished));
    }

    if finished.get("gitCommit").is_some() {
        // Game is finished!
        let winning_id = finished["info"]["winner"][1].as_str();
        tracing::info!(winning_id, game_id, "Game is finished.");

        for player in finished["info"]["players"].as_array().unwrap() {
            if player["clientID"].as_str() == winning_id {
                tracing::info!("Winning player: {}", player["username"]);
            }
        }

        return Ok(GameStatus::Finished(finished));
    }

    tracing::error!("Game {} is in an unknown other state.", game_id);

    anyhow::bail!("Game {} is in an unknown state: {:?}", game_id, finished);
}

pub async fn save_finished_game(
    database: PgPool,
    status: GameStatus,
    game_id: &str,
) -> anyhow::Result<()> {
    let (result_json, is_ok) = match status {
        GameStatus::Finished(json) => (json, true),
        GameStatus::Error(json) => (json, false),
        GameStatus::NotFound => {
            tracing::info!("Game {} not found, skipping.", game_id);
            return Ok(());
        }
    };

    let mut txn = database.begin().await?;
    sqlx::query!(
        "UPDATE lobbies SET completed = true WHERE game_id = $1",
        game_id
    )
    .execute(&mut *txn)
    .await?;

    sqlx::query!(
        "INSERT INTO finished_games (game_id, result_json, is_ok) VALUES ($1, $2, $3)",
        game_id,
        result_json,
        is_ok
    )
    .execute(&mut *txn)
    .await?;

    txn.commit().await?;

    let dur_secs = result_json["info"]["duration"].as_i64().unwrap_or(0);
    let num_turns = result_json["info"]["num_turns"].as_i64().unwrap_or(0);
    tracing::info!(
        dur_secs,
        num_turns,
        "Game {} is finished. Adding results to db.",
        game_id
    );

    Ok(())
}

pub async fn look_for_lobby_games(
    ofapi: impl OpenFrontAPI,
    database: PgPool,
    cfg: std::sync::Arc<Config>,
) -> anyhow::Result<()> {
    let unfinished_games = sqlx::query!(
        "SELECT
            game_id
        FROM lobbies
        WHERE
            completed = false
            AND last_seen_unix_sec < extract(epoch from (NOW() - INTERVAL '15 minutes'))
            -- AND last_seen_unix_sec > extract(epoch from (NOW() - INTERVAL '2 hours'))
        "
    )
    .fetch_all(&database)
    .await?;

    tracing::info!(
        "Found {} unfinished games, checking if they are finished...",
        unfinished_games.len()
    );

    for game in unfinished_games {
        let game_id = &game.game_id;
        let finish_status = check_if_game_finished(&ofapi, game_id).await?;
        save_finished_game(database.clone(), finish_status, game_id).await?;
        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    Ok(())
}

#[derive(Debug, Clone)]
pub enum BackoffStrategy {
    Exponential {
        start: Duration,
        increment: Duration,
        power: f64,
        max_stacks: usize,
    },
    Linear {
        start: Duration,
        increment: Duration,
        max_stacks: usize,
    },
}

impl BackoffStrategy {
    fn next_backoff(&self, current: usize) -> Duration {
        match *self {
            BackoffStrategy::Exponential {
                start,
                increment,
                max_stacks,
                power,
            } => {
                let stacks = current.min(max_stacks);
                let wait_secs = (stacks as f64).powf(power) as u32;
                start + increment * wait_secs
            }
            BackoffStrategy::Linear {
                start,
                increment,
                max_stacks,
            } => {
                let stacks = current.min(max_stacks);
                start + increment * stacks as u32
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct TaskSettings {
    pub sleep_time: Duration,
    pub backoff_strategy: BackoffStrategy,
}

impl Default for BackoffStrategy {
    fn default() -> Self {
        BackoffStrategy::Linear {
            start: Duration::from_secs(5),
            increment: Duration::from_secs(5),
            max_stacks: 10,
        }
    }
}

impl Default for TaskSettings {
    fn default() -> Self {
        TaskSettings {
            sleep_time: Duration::from_secs(60), // 1 minute
            backoff_strategy: BackoffStrategy::default(),
        }
    }
}

pub fn keep_task_alive<F, R>(mut task: F, task_settings: TaskSettings)
where
    F: FnMut() -> R + Send + 'static,
    R: std::future::Future<Output = anyhow::Result<()>> + Send,
{
    tokio::spawn(async move {
        let mut backoff = 0;
        loop {
            if let Err(e) = task().await {
                tracing::error!("Task failed: {}", e);
                tokio::time::sleep(task_settings.backoff_strategy.next_backoff(backoff)).await;
                backoff += 1;
            } else {
                backoff = 0;
            }
            tokio::time::sleep(task_settings.sleep_time).await;
        }
    });
}

pub async fn look_for_new_games_in_analysis_queue(
    ofapi: impl OpenFrontAPI,
    database: PgPool,
    cfg: std::sync::Arc<Config>,
) -> anyhow::Result<()> {
    while look_for_new_game_in_analysis_queue(&ofapi, database.clone(), &*cfg).await? {
        // Keep looking for new games until there are none left.
        tokio::time::sleep(Duration::from_secs(2)).await;
    }

    Ok(())
}

pub async fn look_for_new_game_in_analysis_queue(
    ofapi: &impl OpenFrontAPI,
    database: PgPool,
    cfg: &Config,
) -> anyhow::Result<bool> {
    // Look for games in the analysis queue that we don't have in the finished_games table yet.
    let new_games = sqlx::query!(
        r#"
        SELECT
            aq.game_id, aq.requesting_user_id
        FROM
            analysis_queue aq
            LEFT JOIN finished_games fg
            ON aq.game_id = fg.game_id
        WHERE
            fg.game_id IS NULL
            AND aq.status = 'Pending'
        ORDER BY
            aq.requested_unix_sec ASC
        LIMIT 1
        "#
    )
    .fetch_optional(&database)
    .await?;

    let Some(game) = new_games else {
        return Ok(false);
    };

    let result_maybe = check_if_game_finished(ofapi, &game.game_id).await?;
    // Maybe update the analysis queue.
    let maybe_new_db_status = match result_maybe {
        GameStatus::Finished(_) => None,
        GameStatus::Error(_) => Some(AnalysisQueueStatus::Failed),
        GameStatus::NotFound => Some(AnalysisQueueStatus::NotFound),
    };

    if let Some(new_db_status) = maybe_new_db_status {
        sqlx::query!(
            "UPDATE analysis_queue SET status = $2 WHERE game_id = $1",
            game.game_id,
            new_db_status as AnalysisQueueStatus,
        )
        .execute(&database)
        .await?;
    }

    save_finished_game(database.clone(), result_maybe.clone(), &game.game_id).await?;

    Ok(true)
}
