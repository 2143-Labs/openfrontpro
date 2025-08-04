#![allow(clippy::all)]

use anyhow::Context;
use serde_json;
use sqlx::PgPool;
use std::time::Duration;

use crate::{
    AnalysisQueueStatus, Config,
    api::openfrontapi::{Lobby, OpenFrontAPI},
    database::now_unix_sec,
};

pub async fn get_new_games(ofapi: &impl OpenFrontAPI, _cfg: &Config) -> anyhow::Result<Vec<Lobby>> {
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

pub async fn insert_new_game(first: &Lobby, database: &PgPool) -> anyhow::Result<u64> {
    let player_teams_as_int: i32 = first.game_config.teams().into();

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
    ).execute(database).await?;

    let num_players_left = (first.game_config.max_players - first.num_clients).max(0);

    // Wait between 3 and 15 seconds before checking again.
    let next_time = (first.ms_until_start)
        .min(15500)
        .min(num_players_left as u64 * 1000)
        .max(3500)
        - 500;

    tracing::info!(
        "Lobby {} {} ({}) has {}/{} players. Starts in {}ms. Next check in {}ms.",
        first.game_id,
        first.game_config.game_map,
        first.game_config.teams(),
        first.num_clients,
        first.game_config.max_players,
        first.ms_until_start,
        next_time
    );

    Ok(next_time)
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

        let next_time = insert_new_game(first, &database).await?;

        expected_to_be_new_game_next_check = next_time > first.ms_until_start;
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
    _cfg: std::sync::Arc<Config>,
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

        let should_auto_analyze =
            sqlx::query!("SELECT key, value FROM config WHERE key = 'auto_analyze_games'")
                .fetch_optional(&database)
                .await?
                .map(|row| row.value == "true")
                .unwrap_or(false);

        if should_auto_analyze {
            let res = sqlx::query!(
                "INSERT INTO analysis_queue (game_id, requesting_user_id)
                 VALUES ($1, NULL)",
                game_id,
            )
            .execute(&database)
            .await?;

            if res.rows_affected() > 0 {
                tracing::info!("Game {} added to analysis queue.", game_id);
            } else {
                tracing::info!("Game {} already in analysis queue.", game_id);
            }
        }

        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    Ok(())
}

#[derive(Debug, Clone)]
#[allow(unused)]
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
                let next_backoff_dur = task_settings.backoff_strategy.next_backoff(backoff);
                tracing::error!(wait_sec = next_backoff_dur.as_secs(), "Task failed: {}", e);
                tokio::time::sleep(next_backoff_dur).await;
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
    _cfg: &Config,
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

//look_for_old_running_games(db.clone(), cfg.clone())
pub async fn look_for_old_running_games(
    db: PgPool,
    _cfg: std::sync::Arc<Config>,
) -> anyhow::Result<()> {
    let res = sqlx::query!(
        r#"
        UPDATE
            analysis_queue
        SET
            status = 'Stalled'
        WHERE
            started_unix_sec < extract(epoch from (NOW() - INTERVAL '30 minutes'))
            AND status = 'Running'
        "#
    )
    .execute(&db)
    .await?;
    let q = res.rows_affected();
    tracing::info!("Marked {} analysis queue entries as stalled.", q);

    Ok(())
}

pub async fn update_players_tracked_games(
    db: PgPool,
    openfront_player_id: &str,
    ofapi: &impl OpenFrontAPI,
) -> anyhow::Result<()> {
    let dat = ofapi.get_player_data(openfront_player_id).await?;

    for game in dat["games"].as_array().unwrap() {
        let game_id = game["gameId"].as_str().unwrap();
        let client_id = game["clientId"].as_str().unwrap();
        let new_row = sqlx::query!(
            r#"
            INSERT INTO social.tracked_player_in_game (
                openfront_player_id, game_id, client_id
            ) VALUES ($1, $2, $3)
            ON CONFLICT (openfront_player_id, game_id, client_id) DO NOTHING
            "#,
            openfront_player_id,
            game_id,
            client_id,
        )
        .execute(&db)
        .await?;

        if new_row.rows_affected() > 0 {
            tracing::info!(
                "Inserted player {} with game {} as client ID {}",
                openfront_player_id,
                game_id,
                client_id
            );
        }
    }

    Ok(())
}

pub async fn look_for_tracked_player_games(
    db: PgPool,
    ofapi: impl OpenFrontAPI,
) -> anyhow::Result<()> {
    tracing::info!("Looking for tracked players to update their games...");
    let res = sqlx::query!(
        r#"
        UPDATE
            social.tracked_openfront_players
        SET
            last_check_unix_sec = EXTRACT(EPOCH FROM NOW())
        WHERE
            last_check_unix_sec < extract(epoch from (NOW() - INTERVAL '30 minutes'))
            AND is_tracking = true
        RETURNING openfront_player_id
        "#
    )
    .fetch_all(&db)
    .await?;

    if res.is_empty() {
        return Ok(());
    }

    tracing::info!("Found {} tracked players to update.", res.len());
    for player in res {
        let player_id = &player.openfront_player_id;
        tracing::info!("Checking tracked player: {}", player_id);
        if let Err(e) = update_players_tracked_games(db.clone(), player_id, &ofapi).await {
            tracing::error!("Error updating tracked player {}: {}", player_id, e);
        }
    }
    tracing::info!("Finished updating tracked players' games.");
    Ok(())
}

pub async fn push_to_minio(
    s3_client: aws_sdk_s3::Client,
    config: &Config,
    db: PgPool,
) -> anyhow::Result<()> {
    let res = sqlx::query!(
        "SELECT
            fg.game_id, fg.result_json
        FROM
            finished_games fg
            FULL JOIN 
        WHERE pushed_to_minio = false LIMIT 1"
    )
    .fetch_optional(&db)
    .await?;

    if let Some(row) = res {
        let game_id = row.game_id;
        let result_json: serde_json::Value = serde_json::from_str(&row.result_json)?;

        let bucket_name = &config.minio_bucket;
        let object_key = format!("finished_games/{}.json", game_id);

        let body = aws_sdk_s3::types::ByteStream::from(serde_json::to_string(&result_json)?);
        s3_client
            .put_object()
            .bucket(bucket_name)
            .key(object_key)
            .body(body)
            .send()
            .await?;

        sqlx::query!(
            "UPDATE finished_games SET pushed_to_minio = true WHERE game_id = $1",
            game_id
        )
        .execute(&db)
        .await?;

        tracing::info!("Pushed game {} to MinIO bucket {}", game_id, bucket_name);
    } else {
        tracing::info!("No new games to push to MinIO.");
    }

    Ok(())
}

