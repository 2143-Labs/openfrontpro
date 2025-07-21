#![allow(unused)]
use std::{fmt::Display, net::SocketAddr, str::FromStr, sync::Arc, time::Duration};

mod middleware;
mod oauth;

use aide::{
    axum::ApiRouter,
    openapi::{Info, OpenApi},
    redoc::Redoc,
};
use anyhow::Context;
use axum::{
    Extension, Json,
    extract::{Path, Query, ConnectInfo},
    response::Response,
};
use clap::Parser;
use schemars::JsonSchema;
use sqlx::PgPool;
use tower_http::trace::DefaultMakeSpan;

async fn serve_file(file_path: &std::path::Path) -> anyhow::Result<Response> {
    let file_contents = tokio::fs::read(file_path).await?;

    let response = Response::builder()
        .header("Content-Type", "application/octet-stream")
        .body(axum::body::Body::from(file_contents))?;

    Ok(response)
}

pub async fn open_api_json(Extension(api): Extension<OpenApi>) -> impl aide::axum::IntoApiResponse {
    dbg!(&api);
    Json(api)
}

#[derive(Debug, Clone, clap::Parser)]
struct Config {
    #[clap(long, default_value = "3000")]
    pub port: u16,
    //#[clap(long, short, env)]
    //pub database_url: String,
    #[clap(long, env, default_value = "info")]
    pub rust_log: String,

    #[clap(
        long,
        env,
        default_value = "postgres://postgres@localhost:5432/openfrontpro"
    )]
    pub database_url: String,

    #[clap(long, env)]
    pub useragent: Option<String>,

    #[clap(long, env)]
    pub cookie: Option<String>,

    #[clap(long, env, default_value = "https://openfront.io/api/public_lobbies")]
    pub openfront_lobby_url: String,

    #[clap(long, env, default_value = "https://api.openfront.io")]
    pub openfront_api_url: String,

    #[clap(long, env, default_value = "./frontend")]
    pub frontend_folder: String,

    #[clap(long, env)]
    pub discord_client_id: Option<String>,

    #[clap(long, env)]
    pub discord_client_secret: Option<String>,

    #[clap(
        long,
        env,
        default_value = "http://localhost:3000/auth/discord/callback"
    )]
    pub discord_redirect_uri: String,

    #[clap(long, env, short = 'd')]
    pub disable_tasks: Vec<ActiveTasks>
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema, clap::ValueEnum, PartialEq, Eq)]
pub enum ActiveTasks {
    LookForNewGames,
    LookForLobbyGames,
    LookForNewGamesInAnalysisQueue,
}

// Example Response
//
// {"lobbies":[{"gameID":"8vpnPq5G","numClients":29,"gameConfig":{"gameMap":"Faroe Islands","gameType":"Public","difficulty":"Medium","disableNPCs":false,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Free For All","bots":400,"disabledUnits":[],"maxPlayers":40},"msUntilStart":13941}]}
// {"lobbies":[{"gameID":"U91rErJL","numClients":0,"gameConfig":{"gameMap":"Australia","gameType":"Public","difficulty":"Medium","disableNPCs":false,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Free For All","bots":400,"disabledUnits":[],"maxPlayers":50},"msUntilStart":59901}]}
// {"lobbies":[{"gameID":"PQaySEuD","numClients":33,"gameConfig":{"gameMap":"Gateway to the Atlantic","gameType":"Public","difficulty":"Medium","disableNPCs":true,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Team","bots":400,"disabledUnits":[],"maxPlayers":80,"playerTeams":4},"msUntilStart":45184}]}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
struct PublicLobbiesResponse {
    lobbies: Vec<Lobby>,
}

#[derive(Debug, Clone, serde::Serialize, JsonSchema, PartialEq)]
#[serde(tag = "group")]
enum PlayerTeams {
    FFA,
    Teams { num_teams: u8 },
    Parties { party_size: u8 },
}
// PlayerTeams fromStr:
impl PlayerTeams {
    fn from_str_or_int(s: &StringOrInt) -> Option<Self> {
        if let StringOrInt::String(f) = &s {
            return match f.as_ref() {
                "Duos" => Some(PlayerTeams::Parties { party_size: 2 }),
                "Trios" => Some(PlayerTeams::Parties { party_size: 3 }),
                "Quads" => Some(PlayerTeams::Parties { party_size: 4 }),
                _ => None,
            };
        } else if let StringOrInt::Int(i) = s {
            return Some(PlayerTeams::Teams {
                num_teams: *i as u8,
            });
        }

        None
    }
}

struct PlayerTeamsVisitor;

impl<'de> serde::de::Visitor<'de> for PlayerTeamsVisitor {
    type Value = PlayerTeams;

    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
        formatter.write_str("an integer representing the number of teams or parties")
    }

    fn visit_i32<E>(self, value: i32) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(PlayerTeams::from(value))
    }
}

impl<'d> serde::Deserialize<'d> for PlayerTeams {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'d>,
    {
        deserializer.deserialize_i32(PlayerTeamsVisitor)
    }
}

impl From<i32> for PlayerTeams {
    fn from(num_teams: i32) -> Self {
        if num_teams == 0 {
            PlayerTeams::FFA
        } else if num_teams < 0 {
            PlayerTeams::Parties {
                party_size: -num_teams as u8,
            }
        } else {
            PlayerTeams::Teams {
                num_teams: num_teams as u8,
            }
        }
    }
}

impl From<PlayerTeams> for i32 {
    fn from(teams: PlayerTeams) -> Self {
        match teams {
            PlayerTeams::FFA => 0,
            PlayerTeams::Teams { num_teams } => num_teams as _,
            PlayerTeams::Parties { party_size } => -(party_size as i32),
        }
    }
}

impl sqlx::Decode<'_, sqlx::Postgres> for PlayerTeams {
    fn decode(
        value: sqlx::postgres::PgValueRef<'_>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let s: i32 = sqlx::decode::Decode::<sqlx::Postgres>::decode(value)?;
        Ok(PlayerTeams::from(s))
    }
}

impl Display for PlayerTeams {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PlayerTeams::FFA => write!(f, "FFA"),
            PlayerTeams::Teams { num_teams } => write!(f, "{} Teams", num_teams),
            PlayerTeams::Parties { party_size } => write!(f, "Parties of {}", party_size),
        }
    }
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct Lobby {
    #[serde(rename = "gameID")]
    game_id: String,
    num_clients: i32,
    game_config: GameConfig,
    ms_until_start: u64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
#[serde(untagged)]
enum StringOrInt {
    String(String),
    Int(i32),
}

impl ToString for StringOrInt {
    fn to_string(&self) -> String {
        match self {
            StringOrInt::String(s) => s.clone(),
            StringOrInt::Int(i) => i.to_string(),
        }
    }
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, sqlx::FromRow, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct GameConfig {
    game_map: String,
    game_type: String,
    difficulty: String,
    #[serde(rename = "disableNPCs")]
    disable_npcs: bool,
    infinite_gold: bool,
    infinite_troops: bool,
    instant_build: bool,
    game_mode: String,
    bots: i32,
    disabled_units: Vec<String>,
    max_players: i32,
    player_teams: Option<StringOrInt>,
}

#[cfg(test)]
mod test1 {
    use super::*;

    #[test]
    fn should_parse_lobby() {
        let jsons = [
            r#"{"lobbies":[{"gameID":"mieEQtXo","numClients":1,"gameConfig":{"gameMap":"World","gameType":"Public","difficulty":"Medium","disableNPCs":false,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Free For All","bots":400,"disabledUnits":[],"maxPlayers":50},"msUntilStart":57198}]}"#,
            r#"{"lobbies":[{"gameID":"Q7GMHhAv","numClients":16,"gameConfig":{"gameMap":"Africa","gameType":"Public","difficulty":"Medium","disableNPCs":false,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Free For All","bots":400,"disabledUnits":[],"maxPlayers":80},"msUntilStart":31378}]}"#,
        ];

        for json in jsons {
            let response: PublicLobbiesResponse = serde_json::from_str(json).unwrap();
            assert!(
                !response.lobbies.is_empty(),
                "Lobby list should not be empty"
            );
            assert!(
                response.lobbies[0].ms_until_start > 0,
                "ms_until_start should be greater than 0"
            );
            assert!(
                !response.lobbies[0].game_config.game_map.is_empty(),
                "game_map should not be empty"
            );
        }
    }

    #[test]
    fn test_player_teams_from_str_or_int_edge_cases() {
        // Test string variants that should convert to Parties
        let duos = PlayerTeams::from_str_or_int(&StringOrInt::String("Duos".to_string()));
        assert_eq!(duos, Some(PlayerTeams::Parties { party_size: 2 }));
        
        let trios = PlayerTeams::from_str_or_int(&StringOrInt::String("Trios".to_string()));
        assert_eq!(trios, Some(PlayerTeams::Parties { party_size: 3 }));
        
        let quads = PlayerTeams::from_str_or_int(&StringOrInt::String("Quads".to_string()));
        assert_eq!(quads, Some(PlayerTeams::Parties { party_size: 4 }));
        
        // Test that unknown strings return None
        let unknown = PlayerTeams::from_str_or_int(&StringOrInt::String("Unknown".to_string()));
        assert_eq!(unknown, None);
        
        // Test negative integers should convert to Parties via from_str_or_int -> Teams conversion
        // Note: from_str_or_int converts all ints to Teams, but From<i32> handles negatives as Parties
        let negative_two = PlayerTeams::from_str_or_int(&StringOrInt::Int(-2));
        assert_eq!(negative_two, Some(PlayerTeams::Teams { num_teams: (-2i32) as u8 }));
        
        // Test positive integers convert to Teams
        let positive_four = PlayerTeams::from_str_or_int(&StringOrInt::Int(4));
        assert_eq!(positive_four, Some(PlayerTeams::Teams { num_teams: 4 }));
        
        // Test From<i32> implementation for negative numbers (which creates Parties)
        let from_negative_two = PlayerTeams::from(-2i32);
        assert_eq!(from_negative_two, PlayerTeams::Parties { party_size: 2 });
        
        let from_negative_three = PlayerTeams::from(-3i32);
        assert_eq!(from_negative_three, PlayerTeams::Parties { party_size: 3 });
    }
}

use std::future::Future;

use serde::de::DeserializeOwned;

pub trait ReqwestErrorHandlingExtension
where
    Self: Sized + Send,
{
    fn anyhow_error_text(self) -> impl Future<Output = anyhow::Result<String>> + Send;

    fn anyhow_error_json<T: DeserializeOwned>(
        self,
    ) -> impl Future<Output = anyhow::Result<T>> + Send {
        async move {
            let text = self.anyhow_error_text().await?;
            Ok(serde_json::from_str(&text)?)
        }
    }
}

impl ReqwestErrorHandlingExtension for reqwest::Response {
    async fn anyhow_error_text(self) -> anyhow::Result<String> {
        let status = self.status();
        let url = self.url().to_string();
        let mut text = self.text().await?;

        if !status.is_success() {
            if let Ok(t) = serde_json::from_str::<serde_json::Value>(&text) {
                text = serde_json::to_string_pretty(&t).unwrap();
            }
            tracing::error!(text);
            anyhow::bail!(
                "API Call failed {:?} with code {}: {}",
                url,
                status.as_u16(),
                text
            );
        }

        Ok(text)
    }
}

async fn get_new_games(ofapi: &impl OpenFrontAPI, cfg: &Config) -> anyhow::Result<Vec<Lobby>> {
    let new_games = ofapi.get_lobbies().await?;
    Ok(new_games.lobbies)
}

/// This is put into the database for every lobby we see
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, sqlx::FromRow, JsonSchema)]
struct LobbyDBEntry {
    game_id: String,
    teams: PlayerTeams,
    max_players: i32,
    game_map: String,
    approx_num_players: i32,
    /// Last seen timestamp in seconds
    first_seen_unix_sec: i64,
    /// Last seen timestamp in seconds
    last_seen_unix_sec: i64,
    completed: bool,
    lobby_config_json: serde_json::Value,
    analysis_complete: bool,
}

/// This is put into the database for every lobby we see
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, sqlx::FromRow, JsonSchema)]
struct LobbyDBEntryNoConfig {
    game_id: String,
    teams: PlayerTeams,
    max_players: i32,
    game_map: String,
    approx_num_players: i32,
    /// Last seen timestamp in seconds
    first_seen_unix_sec: i64,
    /// Last seen timestamp in seconds
    last_seen_unix_sec: i64,
    completed: bool,
    analysis_complete: bool,
}

impl<'a> sqlx::FromRow<'a, sqlx::postgres::PgRow> for LobbyDBEntryNoConfig {
    fn from_row(row: &'a sqlx::postgres::PgRow) -> Result<Self, sqlx_core::Error> {
        use sqlx::Row;
        let teams_val: i32 = row.try_get("teams")?;
        let teams = PlayerTeams::from(teams_val);

        Ok(LobbyDBEntryNoConfig {
            game_id: row.try_get("game_id")?,
            teams,
            max_players: row.try_get("max_players")?,
            game_map: row.try_get("game_map")?,
            approx_num_players: row.try_get("approx_num_players")?,
            first_seen_unix_sec: row.try_get("first_seen_unix_sec")?,
            last_seen_unix_sec: row.try_get("last_seen_unix_sec")?,
            completed: row.try_get("completed")?,
            analysis_complete: row.try_get("analysis_complete!")?,
        })
    }
}

impl LobbyDBEntry {
    pub fn lobby_config(&self) -> GameConfig {
        serde_json::from_value(self.lobby_config_json.clone())
            .expect("Invalid lobby config JSON in database")
    }
}

impl GameConfig {
    pub fn player_teams(&self) -> PlayerTeams {
        if let Some(ref teams) = self.player_teams {
            PlayerTeams::from_str_or_int(teams).unwrap()
        } else {
            PlayerTeams::FFA
        }
    }
}

fn now_unix_sec() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("System time before UNIX EPOCH")
        .as_secs() as i64
}

async fn look_for_new_games(ofapi: impl OpenFrontAPI, database: PgPool, cfg: std::sync::Arc<Config>) -> anyhow::Result<()> {
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

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema, PartialEq, Eq)]
enum GameStatus {
    Finished(serde_json::Value),
    Error(serde_json::Value),
    NotFound,
}

async fn check_if_game_finished(ofapi: impl OpenFrontAPI, game_id: &str) -> anyhow::Result<GameStatus> {
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

async fn save_finished_game(
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

#[mockall::automock]

trait OpenFrontAPI {
    fn get_game_json(&self, game_id: &str) -> impl Future<Output = anyhow::Result<serde_json::Value>> + Send;
    fn get_lobbies(&self) -> impl Future<Output = anyhow::Result<PublicLobbiesResponse>> + Send;
}

impl OpenFrontAPI for Config {
    async fn get_game_json(&self, game_id: &str) -> anyhow::Result<serde_json::Value> {
        let url = format!("{}/game/{}", self.openfront_api_url, game_id);

        let finished = reqwest::get(url)
            .await?
            .json::<serde_json::Value>()
            .await?;

        Ok(finished)
    }

    async fn get_lobbies(&self) -> anyhow::Result<PublicLobbiesResponse> {
        let mut base = reqwest::Client::new().get(&self.openfront_lobby_url);
        if let Some(ref useragent) = self.useragent {
            base = base.header(reqwest::header::USER_AGENT, useragent);
        }
        if let Some(ref cookie) = self.cookie {
            base = base.header(reqwest::header::COOKIE, cookie);
        }

        let new_games = base
            .send()
            .await?
            .anyhow_error_json::<PublicLobbiesResponse>()
            .await?;

        Ok(new_games)
    }
}

impl<T> OpenFrontAPI for &T where
    T: OpenFrontAPI + ?Sized,
{
    fn get_game_json(&self, game_id: &str) -> impl Future<Output = anyhow::Result<serde_json::Value>> + Send {
        T::get_game_json(self, game_id)
    }

    fn get_lobbies(&self) -> impl Future<Output = anyhow::Result<PublicLobbiesResponse>> + Send {
        T::get_lobbies(self)
    }
}

impl<T> OpenFrontAPI for Arc<T> where T: OpenFrontAPI + ?Sized,
{
    fn get_game_json(&self, game_id: &str) -> impl Future<Output = anyhow::Result<serde_json::Value>> + Send {
        T::get_game_json(self, game_id)
    }

    fn get_lobbies(&self) -> impl Future<Output = anyhow::Result<PublicLobbiesResponse>> + Send {
        T::get_lobbies(self)
    }
}


async fn look_for_lobby_games(
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

enum BackoffStrategy {
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
            BackoffStrategy::Exponential { start, increment, max_stacks, power } => {
                let stacks = current.min(max_stacks);
                let wait_secs = (stacks as f64).powf(power) as u32;
                start + increment * wait_secs
            }
            BackoffStrategy::Linear { start, increment, max_stacks } => {
                let stacks = current.min(max_stacks);
                start + increment * stacks as u32
            }
        }
    }
}


struct TaskSettings {
    sleep_time: Duration,
    backoff_strategy: BackoffStrategy,
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

fn keep_task_alive<F, R>(
    mut task: F,
    task_settings: TaskSettings,
) where F: FnMut() -> R + Send + 'static, R: Future<Output = anyhow::Result<()>> + Send{
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

/// CREATE TABLE IF NOT EXISTS finished_games (
///     game_id CHAR(8) PRIMARY KEY,
///     result_json JSONB NOT NULL,
///     is_ok BOOLEAN NOT NULL DEFAULT TRUE,
///     inserted_at_unix_sec bigint NOT NULL DEFAULT extract(epoch from NOW()),
///     FOREIGN KEY (game_id) REFERENCES lobbies(game_id) ON DELETE CASCADE
/// );
/// CREATE TYPE analysis_queue_status AS ENUM (
///     'Pending',
///     'Running',
///     'Completed',
///     'NotFound',
///     'Failed',
///     'Stalled',
///     'Cancelled',
///     'CompletedAlready'
/// );
///
/// CREATE TABLE public.analysis_queue (
///     game_id CHAR(8) NOT NULL,
///     requesting_user_id CHAR(10),
///     requested_unix_sec BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
///     started_unix_sec BIGINT,
///     status analysis_queue_status NOT NULL DEFAULT 'Pending',
///     FOREIGN KEY (requesting_user_id) REFERENCES social.registered_users(id) ON DELETE CASCADE
/// );
///
async fn look_for_new_games_in_analysis_queue(
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
async fn look_for_new_game_in_analysis_queue(
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


#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
struct LobbyQueryParams {
    completed: Option<bool>,
    game_map: Option<String>,
    /// Unix timestamp in seconds
    after: Option<i64>,
    /// Unix timestamp in seconds
    before: Option<i64>,
}
async fn lobbies_id_handler(
    Extension(database): Extension<PgPool>,
    Query(params): Query<LobbyQueryParams>,
    Path(id): Path<String>,
) -> Result<Json<LobbyDBEntry>, Response> {
    let d = sqlx::query_as!(
        LobbyDBEntry,
        r#"SELECT
            lo.*,
            (co.inserted_at_unix_sec IS NOT NULL) AS "analysis_complete!"
        FROM
            lobbies lo
            LEFT JOIN analysis_1.completed_analysis co
            ON lo.game_id = co.game_id
        WHERE lo.game_id = $1"#,
        id
    );

    let lobby = d.fetch_one(&database).await.map_err(|e| {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::NOT_FOUND)
            .body(axum::body::Body::from(format!("Lobby not found: {}", e)))
            .expect("Failed to build response for error message")
    })?;

    Ok(Json(lobby))
}

async fn lobbies_handler(
    Extension(database): Extension<PgPool>,
    Query(params): Query<LobbyQueryParams>,
) -> Result<Json<Vec<LobbyDBEntryNoConfig>>, Response> {
    let mut querybuilder = sqlx::query_builder::QueryBuilder::new(
        r#"
        SELECT
            lo.game_id, lo.teams, lo.max_players, lo.game_map, lo.approx_num_players,
            lo.first_seen_unix_sec, lo.last_seen_unix_sec, lo.completed,
            (co.inserted_at_unix_sec IS NOT NULL) AS "analysis_complete!"
        FROM
            public.lobbies lo
            LEFT JOIN analysis_1.completed_analysis co
            ON lo.game_id = co.game_id
        "#,
    );

    let mut _has_where = false;

    if let Some(completed) = params.completed {
        if _has_where {
            querybuilder.push(" AND ");
        } else {
            querybuilder.push(" WHERE ");
        }
        _has_where = true;

        querybuilder.push(" completed = ");
        querybuilder.push_bind(completed);
    }

    if let Some(ref before) = params.before {
        if _has_where {
            querybuilder.push(" AND ");
        } else {
            querybuilder.push(" WHERE ");
        }
        _has_where = true;

        querybuilder.push("last_seen_unix_sec < ");
        querybuilder.push_bind(before);
    }

    if let Some(ref after) = params.after {
        if _has_where {
            querybuilder.push(" AND ");
        } else {
            querybuilder.push(" WHERE ");
        }
        _has_where = true;

        querybuilder.push("first_seen_unix_sec > ");
        querybuilder.push_bind(after);
    }

    if let Some(ref game_map) = params.game_map {
        if _has_where {
            querybuilder.push(" AND ");
        } else {
            querybuilder.push(" WHERE ");
        }
        _has_where = true;

        querybuilder.push("game_map = ");
        querybuilder.push_bind(game_map);
    }

    querybuilder.push(" ORDER BY last_seen_unix_sec DESC LIMIT 100");

    let res: Vec<LobbyDBEntryNoConfig> = querybuilder
        .build_query_as()
        .fetch_all(&database)
        .await
        .map_err(|e| {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!(
                "Database query failed: {}",
                e
            )))
            .expect("Failed to build response for error message")
    })?;

    Ok(Json(res))
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
struct FinshedGameDBEntry {
    game_id: String,
    result_json: serde_json::Value,
    inserted_at_unix_sec: i64,
}

async fn game_handler(
    Extension(database): Extension<PgPool>,
    Path(game_id): Path<String>,
) -> Result<Json<serde_json::Value>, Response> {
    let lobby = sqlx::query_as!(
        FinshedGameDBEntry,
        "SELECT game_id, result_json, inserted_at_unix_sec FROM finished_games WHERE game_id = $1",
        game_id
    )
    .fetch_one(&database)
    .await
    .map_err(|e| {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::NOT_FOUND)
            .body(axum::body::Body::from(format!("Lobby not found: {}", e)))
            .expect("Failed to build response for error message")
    })?;

    Ok(Json(lobby.result_json))
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema, sqlx::Type)]
#[sqlx(type_name = "analysis_queue_status")]
enum AnalysisQueueStatus {
    Pending,
    Running,
    Completed,
    NotFound,
    Failed,
    Stalled,
    Cancelled,
    CompletedAlready,
}

async fn game_analyze_handler(
    Extension(database): Extension<PgPool>,
    Path(game_id): Path<String>,
) -> Result<(), Response> {
    //Insert into analysis_queue
    let res = sqlx::query!(
        "INSERT INTO analysis_queue (game_id)
         VALUES ($1)
         ON CONFLICT (game_id) DO NOTHING",
        game_id,
    )
    .execute(&database)
    .await;

    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(axum::response::Response::builder()
            .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!(
                "Failed to queue analysis: {}",
                e
            )))
            .expect("Failed to build response for error message")),
    }
}

async fn game_analyze_handler_delete(
    Extension(database): Extension<PgPool>,
    Path(game_id): Path<String>,
) -> Result<(), Response> {
    // Set status to cancelled
    let res = sqlx::query!(
        "UPDATE analysis_queue SET status = 'Cancelled' WHERE game_id = $1",
        game_id,
    )
    .execute(&database)
    .await;

    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(axum::response::Response::builder()
            .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!(
                "Failed to cancel analysis: {}",
                e
            )))
            .expect("Failed to build response for error message")),
    }
}

#[tokio::main(flavor = "multi_thread", worker_threads = 16)]
async fn main() -> anyhow::Result<()> {
    let config = Config::parse();
    let config = std::sync::Arc::new(config);

    let database = PgPool::connect(&config.database_url)
        .await
        .context("Failed to connect to the database")?;

    sqlx::migrate!("./migrations").run(&database).await?;

    tracing::info!("Migrations applied successfully");

    tracing_subscriber::fmt()
        //.with_max_level(tracing::Level::INFO)
        .with_env_filter(&config.rust_log)
        .with_target(false)
        // disabling time is handy because CloudWatch will add the ingestion time.
        .without_time()
        .init();

    let cors = tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(vec![
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers(tower_http::cors::Any);

    let api_routes = ApiRouter::new()
        .route("/lobbies", axum::routing::get(lobbies_handler))
        .route("/lobbies/{id}", axum::routing::get(lobbies_id_handler))
        .api_route("/games/{game_id}", aide::axum::routing::get(game_handler))
        .route(
            "/games/{game_id}/analyze",
            axum::routing::get(game_analyze_handler).delete(game_analyze_handler_delete),
        );
    //.route("/games/{game_id}/analyze", axum::routing::get(game_analyze_handler).delete(game_analyze_handler_delete))

    let routes = ApiRouter::new()
        .route("/health", axum::routing::get(|| async { "ok!" }))
        .nest("/api/v1/", api_routes)
        .route("/openapi.json", axum::routing::get(open_api_json))
        .route("/redoc", Redoc::new("/openapi.json").axum_route());

    let mut openapi = OpenApi {
        info: Info {
            title: "openfront.pro".to_string(),
            version: "1.0.0".to_string(),
            description: Some(
                "This API can be used to access elo data, match data, and more".to_string(),
            ),
            ..Default::default()
        },
        ..Default::default()
    };

    let missing_html = format!("{}/404.html", config.frontend_folder);

    let fin = routes
        .finish_api(&mut openapi)
        .layer(Extension(openapi.clone()))
        .layer(Extension(database.clone()))
        .layer(
            tower_http::trace::TraceLayer::new_for_http()
                .on_request(middleware::LogOnRequest)
                .on_response(middleware::LogOnResponse)
        )
        .layer(tower_http::normalize_path::NormalizePathLayer::trim_trailing_slash())
        .layer(cors)
        .fallback_service(axum::routing::get_service(
            tower_http::services::ServeDir::new(&*config.frontend_folder)
                .append_index_html_on_directories(true)
                .not_found_service(axum::routing::get(|| async move {
                    serve_file(&std::path::Path::new(&missing_html))
                        .await
                        .unwrap_or(axum::response::Response::builder()
                            .status(axum::http::StatusCode::NOT_FOUND)
                            .body(axum::body::Body::from("Sorry! The frontend folder is missing!"))
                            .expect("Failed to build 404 response"))
                })),
        ));


    if !config.disable_tasks.contains(&ActiveTasks::LookForNewGames) {
        let db = database.clone();
        let cfg = config.clone();
        let ofapi = config.clone();
        keep_task_alive(
            move || look_for_new_games(ofapi.clone(), db.clone(), cfg.clone()),
            TaskSettings {
                sleep_time: tokio::time::Duration::ZERO,
                ..Default::default()
            },
        );
    }

    if !config.disable_tasks.contains(&ActiveTasks::LookForNewGamesInAnalysisQueue) {
        let db = database.clone();
        let cfg = config.clone();
        let ofapi = config.clone();
        keep_task_alive(
            move || look_for_new_games_in_analysis_queue(ofapi.clone(), db.clone(), cfg.clone()),
            TaskSettings {
                sleep_time: tokio::time::Duration::from_secs(5),
                ..Default::default()
            },
        );
    }

    if !config.disable_tasks.contains(&ActiveTasks::LookForLobbyGames) {

        let db = database.clone();
        let cfg = config.clone();
        let ofapi = config.clone();
        keep_task_alive(
            move || look_for_lobby_games(ofapi.clone(), db.clone(), cfg.clone()),
            TaskSettings {
                sleep_time: tokio::time::Duration::from_secs(60 * 5),
                ..Default::default()
            },
        );
    }

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;
    tracing::info!("Listening on {}", listener.local_addr()?);
    axum::serve(
        listener,
        fin.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    anyhow::bail!("Server stopped unexpectedly");
}

#[cfg(test)]
mod test2 {
    use futures::FutureExt;

    use super::*;

    /// Original helper function for basic mocking with game fixture loading
    fn create_mocked_api() -> MockOpenFrontAPI {
        let mut mocked_api = MockOpenFrontAPI::new();
        mocked_api.expect_get_lobbies()
            .returning(|| async {
                Ok(PublicLobbiesResponse {
                    lobbies: vec![Lobby {
                        game_id: "testgame".to_string(),
                        num_clients: 1,
                        game_config: GameConfig {
                            game_map: "Test Map".to_string(),
                            game_type: "Public".to_string(),
                            difficulty: "Medium".to_string(),
                            disable_npcs: false,
                            infinite_gold: false,
                            infinite_troops: false,
                            instant_build: false,
                            game_mode: "Free For All".to_string(),
                            bots: 0,
                            disabled_units: vec![],
                            max_players: 10,
                            player_teams: None,
                        },
                        ms_until_start: 60000,
                    }],
                })
            }.boxed());
    
    // Four distinct mocked API scenarios for comprehensive testing:
    //
    // 1. create_mocked_api_finished_game() - Returns valid finished game JSON from mygame.json fixture
    // 2. create_mocked_api_error_state() - Returns {"error":"Some failure"} 
    // 3. create_mocked_api_not_found() - Returns {"error":"Not found"}
    // 4. create_mocked_api_malformed() - Returns Err(anyhow!("bad json"))
    //
    // Each function uses return_once() for single test usage, allowing precise
    // control over API responses for different test scenarios.


        fn load_game_in_test(game_id: &str) -> Option<serde_json::Value> {
            // load it from ./examples/gamedata/
            let dir = include_dir::include_dir!("$CARGO_MANIFEST_DIR/examples/gamedata");
            let file = dir.get_file(&format!("{}.json", game_id))?;
            let json: serde_json::Value = serde_json::from_slice(file.contents())
                .expect("Failed to parse game JSON from examples/gamedata");

            Some(json)
        }
        mocked_api.expect_get_game_json()
            .returning(|game_id| {
                let game_id = game_id.to_string(); async move {
                if let Some(json) = load_game_in_test(&game_id) {
                    Ok(json)
                } else {
                    Err(anyhow::anyhow!("Game not found"))
                }
            }.boxed()});

        mocked_api
    }

    /// Create a mocked API that returns a finished game using the mygame.json fixture
    fn create_mocked_api_finished_game() -> MockOpenFrontAPI {
        let mut mocked_api = MockOpenFrontAPI::new();
        
        // Setup get_lobbies with default behavior
        mocked_api.expect_get_lobbies()
            .return_once(|| async {
                Ok(PublicLobbiesResponse { lobbies: vec![] })
            }.boxed());

        // Setup get_game_json to return valid finished game data from mygame.json
        mocked_api.expect_get_game_json()
            .return_once(|_game_id| async move {
                let dir = include_dir::include_dir!("$CARGO_MANIFEST_DIR/examples/gamedata");
                let file = dir.get_file("mygame.json")
                    .expect("mygame.json fixture should exist");
                let json: serde_json::Value = serde_json::from_slice(file.contents())
                    .expect("Failed to parse mygame.json");
                Ok(json)
            }.boxed());

        mocked_api
    }

    /// Create a mocked API that returns a generic error state
    fn create_mocked_api_error_state() -> MockOpenFrontAPI {
        let mut mocked_api = MockOpenFrontAPI::new();
        
        // Setup get_lobbies with default behavior
        mocked_api.expect_get_lobbies()
            .return_once(|| async {
                Ok(PublicLobbiesResponse { lobbies: vec![] })
            }.boxed());

        // Setup get_game_json to return error JSON
        mocked_api.expect_get_game_json()
            .return_once(|_game_id| async move {
                Ok(serde_json::json!({"error": "Some failure"}))
            }.boxed());

        mocked_api
    }

    /// Create a mocked API that returns a "Not found" error
    fn create_mocked_api_not_found() -> MockOpenFrontAPI {
        let mut mocked_api = MockOpenFrontAPI::new();
        
        // Setup get_lobbies with default behavior
        mocked_api.expect_get_lobbies()
            .return_once(|| async {
                Ok(PublicLobbiesResponse { lobbies: vec![] })
            }.boxed());

        // Setup get_game_json to return "Not found" error JSON
        mocked_api.expect_get_game_json()
            .return_once(|_game_id| async move {
                Ok(serde_json::json!({"error": "Not found"}))
            }.boxed());

        mocked_api
    }

    /// Create a mocked API that returns malformed JSON (anyhow error)
    fn create_mocked_api_malformed() -> MockOpenFrontAPI {
        let mut mocked_api = MockOpenFrontAPI::new();
        
        // Setup get_lobbies with default behavior
        mocked_api.expect_get_lobbies()
            .return_once(|| async {
                Ok(PublicLobbiesResponse { lobbies: vec![] })
            }.boxed());

        // Setup get_game_json to return an anyhow error for bad JSON
        mocked_api.expect_get_game_json()
            .return_once(|_game_id| async move {
                Err(anyhow::anyhow!("bad json"))
            }.boxed());

        mocked_api
    }

    // SQLX Tests:
    #[sqlx::test]
    async fn test_insert_lobby(pool: PgPool) {
        let mock = create_mocked_api();
        let cfg = Config {
            port: 3000,
            rust_log: "info".to_string(),
            database_url: "postgres://test".to_string(),
            useragent: None,
            cookie: None,
            openfront_lobby_url: "https://openfront.io/api/public_lobbies".to_string(),
            openfront_api_url: "https://api.openfront.io".to_string(),
            frontend_folder: "./frontend".to_string(),
            discord_client_id: None,
            discord_client_secret: None,
            discord_redirect_uri: "http://localhost:3000/auth/discord/callback".to_string(),
        };

        // Instead of calling look_for_new_games, call get_new_games directly
        let new_games = get_new_games(&mock, &cfg).await.unwrap();
        assert!(!new_games.is_empty(), "Should have at least one game from mocked API");
        
        let lobby = &new_games[0];
        
        // Perform manual DB insert using same logic as look_for_new_games
        let player_teams_as_int: i32 = lobby.game_config.player_teams().into();
        let test_timestamp = now_unix_sec();

        // Insert the lobby into the database using the same query as the real code
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
            lobby.game_id,
            player_teams_as_int,
            lobby.game_config.max_players,
            lobby.game_config.game_map,
            lobby.num_clients,
            test_timestamp,
            serde_json::to_value(&lobby.game_config).unwrap()
        ).execute(&pool).await.unwrap();

        // Query back the inserted row to verify it was inserted correctly
        let inserted_lobby = sqlx::query_as!(
            LobbyDBEntry,
            r#"SELECT
                *,
                false AS "analysis_complete!"
            FROM
                lobbies
            WHERE game_id = $1"#,
            lobby.game_id
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        // Assert that the row appears with correct fields
        assert_eq!(inserted_lobby.game_id, "testgame");
        assert_eq!(inserted_lobby.max_players, 10);
        assert_eq!(inserted_lobby.game_map, "Test Map");
        assert_eq!(inserted_lobby.approx_num_players, 1);
        assert_eq!(inserted_lobby.first_seen_unix_sec, test_timestamp);
        assert_eq!(inserted_lobby.last_seen_unix_sec, test_timestamp);
        assert_eq!(inserted_lobby.completed, false);
        assert_eq!(inserted_lobby.teams, PlayerTeams::FFA);
        
        // Verify the JSON config was stored correctly
        let config = inserted_lobby.lobby_config();
        assert_eq!(config.game_map, "Test Map");
        assert_eq!(config.max_players, 10);
        assert_eq!(config.game_mode, "Free For All");
    }

    // Example tests demonstrating the four mock API scenarios
    
    #[tokio::test]
    async fn test_finished_game_scenario() {
        let mocked_api = create_mocked_api_finished_game();
        let status = check_if_game_finished(&mocked_api, "test_game").await.unwrap();
        
        match status {
            GameStatus::Finished(json) => {
                // Verify it's a finished game by checking for gitCommit field
                assert!(json.get("gitCommit").is_some(), "Expected finished game to have gitCommit field");
            }
            _ => panic!("Expected GameStatus::Finished but got {:?}", status),
        }
    }

    #[tokio::test]
    async fn test_error_state_scenario() {
        let mocked_api = create_mocked_api_error_state();
        let status = check_if_game_finished(&mocked_api, "test_game").await.unwrap();
        
        match status {
            GameStatus::Error(json) => {
                assert_eq!(json["error"], "Some failure");
            }
            _ => panic!("Expected GameStatus::Error but got {:?}", status),
        }
    }

    #[tokio::test]
    async fn test_not_found_scenario() {
        let mocked_api = create_mocked_api_not_found();
        let status = check_if_game_finished(&mocked_api, "test_game").await.unwrap();
        
        match status {
            GameStatus::NotFound => {
                // Expected - this is the correct behavior
            }
            _ => panic!("Expected GameStatus::NotFound but got {:?}", status),
        }
    }

    #[tokio::test]
    async fn test_game_status_malformed() {
        let mocked_api = create_mocked_api_malformed();
        let result = check_if_game_finished(&mocked_api, "test_game").await;

        assert!(result.is_err(), "Expected an error due to malformed JSON");
        let error = result.unwrap_err();
        assert_eq!(error.to_string(), "bad json");
    }

    // Step 3: Test GameStatus detection via check_if_game_finished
    
    #[tokio::test]
    async fn test_game_status_finished() {
        let mocked_api = create_mocked_api_finished_game();
        let status = check_if_game_finished(&mocked_api, "test_game").await.unwrap();
        
        match status {
            GameStatus::Finished(json) => {
                // Verify it's a finished game by checking for gitCommit field
                assert!(json.get("gitCommit").is_some(), "Expected finished game to have gitCommit field");
                
                // Check winner id exists
                let winner_id = json["info"]["winner"][1].as_str().expect("Winner ID should exist");
                assert!(!winner_id.is_empty(), "Winner ID should not be empty");
                
                // Check players length > 0
                let players = json["info"]["players"].as_array().expect("Players should be an array");
                assert!(players.len() > 0, "Players array should not be empty");
                
                // Check duration > 0
                let duration = json["info"]["duration"].as_i64().expect("Duration should exist");
                assert!(duration > 0, "Duration should be greater than 0");
                
                // Check num_turns > 0
                let num_turns = json["info"]["num_turns"].as_i64().expect("Num turns should exist");
                assert!(num_turns > 0, "Num turns should be greater than 0");
            }
            _ => panic!("Expected GameStatus::Finished but got {:?}", status),
        }
    }

    #[tokio::test]
    async fn test_game_status_error() {
        let mocked_api = create_mocked_api_error_state();
        let status = check_if_game_finished(&mocked_api, "test_game").await.unwrap();
        
        match status {
            GameStatus::Error(json) => {
                assert_eq!(json["error"], "Some failure");
            }
            _ => panic!("Expected GameStatus::Error but got {:?}", status),
        }
    }

    #[tokio::test]
    async fn test_game_status_not_found() {
        let mocked_api = create_mocked_api_not_found();
        let status = check_if_game_finished(&mocked_api, "test_game").await.unwrap();
        
        match status {
            GameStatus::NotFound => {
                // Expected - this is the correct behavior
            }
            _ => panic!("Expected GameStatus::NotFound but got {:?}", status),
        }
    }

    // Step 6: Add finished game database integration tests using #[sqlx::test]
    
    #[sqlx::test]
    async fn test_save_finished_game_with_finished_status(pool: PgPool) {
        let game_id = "testfin1";
        
        // Insert a dummy lobby row (simulate previously tracked game)
        let test_timestamp = now_unix_sec();
        let dummy_config = serde_json::json!({
            "gameMap": "Test Map",
            "gameType": "Public",
            "difficulty": "Medium",
            "maxPlayers": 10
        });
        
        sqlx::query!(
            "INSERT INTO lobbies (game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec, completed, lobby_config_json)
             VALUES ($1, $2, $3, $4, $5, $6, $6, false, $7)",
            game_id,
            0, // FFA
            10,
            "Test Map",
            5,
            test_timestamp,
            dummy_config
        )
        .execute(&pool)
        .await
        .unwrap();

        // Verify lobby was inserted and completed is false initially
        let initial_lobby = sqlx::query!("SELECT completed FROM lobbies WHERE game_id = $1", game_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(initial_lobby.completed, false);

        // Create finished game JSON with winner info
        let finished_game_json = serde_json::json!({
            "gitCommit": "abc123def456",
            "info": {
                "gameID": game_id,
                "winner": ["player", "player123"],
                "duration": 1200,
                "num_turns": 5000,
                "players": [
                    {
                        "clientID": "player123",
                        "username": "WinnerPlayer"
                    }
                ]
            }
        });

        // Call save_finished_game with GameStatus::Finished
        let game_status = GameStatus::Finished(finished_game_json.clone());
        save_finished_game(pool.clone(), game_status, game_id).await.unwrap();

        // Assert: lobbies.completed flag set to true
        let updated_lobby = sqlx::query!("SELECT completed FROM lobbies WHERE game_id = $1", game_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(updated_lobby.completed, true);

        // Assert: finished_games has row with same game_id, result_json->info->winner present, is_ok true
        let finished_game = sqlx::query!(
            "SELECT game_id, result_json, is_ok FROM finished_games WHERE game_id = $1",
            game_id
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(finished_game.game_id, game_id);
        assert_eq!(finished_game.is_ok, true);
        
        // Verify result_json contains winner info
        let result_json = &finished_game.result_json;
        assert!(result_json["info"]["winner"].is_array());
        assert_eq!(result_json["info"]["winner"][0], "player");
        assert_eq!(result_json["info"]["winner"][1], "player123");
        assert!(result_json["gitCommit"].is_string());
    }

    #[sqlx::test]
    async fn test_save_finished_game_with_error_status(pool: PgPool) {
        let game_id = "testerr1";
        
        // Insert a dummy lobby row (simulate previously tracked game)
        let test_timestamp = now_unix_sec();
        let dummy_config = serde_json::json!({
            "gameMap": "Error Test Map",
            "gameType": "Public",
            "difficulty": "Hard",
            "maxPlayers": 20
        });
        
        sqlx::query!(
            "INSERT INTO lobbies (game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec, completed, lobby_config_json)
             VALUES ($1, $2, $3, $4, $5, $6, $6, false, $7)",
            game_id,
            2, // 2 teams
            20,
            "Error Test Map",
            8,
            test_timestamp,
            dummy_config
        )
        .execute(&pool)
        .await
        .unwrap();

        // Verify lobby was inserted and completed is false initially
        let initial_lobby = sqlx::query!("SELECT completed FROM lobbies WHERE game_id = $1", game_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(initial_lobby.completed, false);

        // Create error game JSON
        let error_game_json = serde_json::json!({
            "error": "Game failed to complete due to server error",
            "gameID": game_id,
            "timestamp": test_timestamp
        });

        // Call save_finished_game with GameStatus::Error
        let game_status = GameStatus::Error(error_game_json.clone());
        save_finished_game(pool.clone(), game_status, game_id).await.unwrap();

        // Assert: lobbies.completed flag set to true
        let updated_lobby = sqlx::query!("SELECT completed FROM lobbies WHERE game_id = $1", game_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(updated_lobby.completed, true);

        // Assert: finished_games has row with same game_id, result_json with error, is_ok false
        let finished_game = sqlx::query!(
            "SELECT game_id, result_json, is_ok FROM finished_games WHERE game_id = $1",
            game_id
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(finished_game.game_id, game_id);
        assert_eq!(finished_game.is_ok, false); // Key difference from successful completion
        
        // Verify result_json contains error info
        let result_json = &finished_game.result_json;
        assert_eq!(result_json["error"], "Game failed to complete due to server error");
        assert_eq!(result_json["gameID"], game_id);
    }

    #[sqlx::test]
    async fn test_save_finished_game_with_not_found_status(pool: PgPool) {
        let game_id = "testnf01";
        
        // Insert a dummy lobby row (simulate previously tracked game)
        let test_timestamp = now_unix_sec();
        let dummy_config = serde_json::json!({
            "gameMap": "Not Found Test Map",
            "gameType": "Private",
            "difficulty": "Easy",
            "maxPlayers": 5
        });
        
        sqlx::query!(
            "INSERT INTO lobbies (game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec, completed, lobby_config_json)
             VALUES ($1, $2, $3, $4, $5, $6, $6, false, $7)",
            game_id,
            -2, // Parties of 2
            5,
            "Not Found Test Map",
            3,
            test_timestamp,
            dummy_config
        )
        .execute(&pool)
        .await
        .unwrap();

        // Verify lobby was inserted and completed is false initially
        let initial_lobby = sqlx::query!("SELECT completed FROM lobbies WHERE game_id = $1", game_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(initial_lobby.completed, false);

        // Call save_finished_game with GameStatus::NotFound
        let game_status = GameStatus::NotFound;
        save_finished_game(pool.clone(), game_status, game_id).await.unwrap();

        // Assert: With NotFound status, the function should return early without doing anything
        // lobbies.completed should remain false
        let updated_lobby = sqlx::query!("SELECT completed FROM lobbies WHERE game_id = $1", game_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(updated_lobby.completed, false); // Should remain unchanged

        // Assert: No row should be inserted into finished_games table for NotFound status
        let finished_game_count = sqlx::query!(
            "SELECT COUNT(*) as count FROM finished_games WHERE game_id = $1",
            game_id
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(finished_game_count.count.unwrap_or(0), 0); // No rows should exist
    }

    #[sqlx::test]
    async fn test_save_finished_game_transactional_behavior(pool: PgPool) {
        let game_id = "testtxn1";
        
        // Insert a dummy lobby row
        let test_timestamp = now_unix_sec();
        let dummy_config = serde_json::json!({
            "gameMap": "Transaction Test Map",
            "gameType": "Public",
            "difficulty": "Medium",
            "maxPlayers": 10
        });
        
        sqlx::query!(
            "INSERT INTO lobbies (game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec, completed, lobby_config_json)
             VALUES ($1, $2, $3, $4, $5, $6, $6, false, $7)",
            game_id,
            0, // FFA
            10,
            "Transaction Test Map",
            7,
            test_timestamp,
            dummy_config
        )
        .execute(&pool)
        .await
        .unwrap();

        // Create finished game JSON with all required winner structure
        let finished_game_json = serde_json::json!({
            "gitCommit": "transaction_test_commit",
            "info": {
                "gameID": game_id,
                "winner": ["player", "txn_player"],
                "duration": 800,
                "num_turns": 3000,
                "players": [
                    {
                        "clientID": "txn_player",
                        "username": "TransactionTester"
                    }
                ]
            }
        });

        // Call save_finished_game which should execute both updates in a transaction
        let game_status = GameStatus::Finished(finished_game_json.clone());
        save_finished_game(pool.clone(), game_status, game_id).await.unwrap();

        // Both the lobby update and finished_games insert should have succeeded together
        // Verify both changes were committed
        let lobby_result = sqlx::query!("SELECT completed FROM lobbies WHERE game_id = $1", game_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(lobby_result.completed, true);

        let finished_game_result = sqlx::query!(
            "SELECT game_id, is_ok FROM finished_games WHERE game_id = $1",
            game_id
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(finished_game_result.game_id, game_id);
        assert_eq!(finished_game_result.is_ok, true);
    }

    /// Helper function to run one iteration of the look_for_finished_games inner logic
    /// This extracts the core logic without the infinite loop for testing purposes
    async fn look_for_finished_games_single_iteration(
        ofapi: &impl OpenFrontAPI, 
        database: PgPool
    ) -> anyhow::Result<usize> {
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

        let mut processed_count = 0;
        for game in unfinished_games {
            let game_id = &game.game_id;
            let finish_status = check_if_game_finished(ofapi, game_id).await?;
            save_finished_game(database.clone(), finish_status, game_id).await?;
            processed_count += 1;
        }

        Ok(processed_count)
    }

    #[sqlx::test]
    async fn test_look_for_finished_games_regression(pool: PgPool) {
        let game_id = "regtest1";
        
        // Insert an unfinished game with last_seen_unix_sec older than 15 minutes
        let fifteen_min_ago = now_unix_sec() - (16 * 60); // 16 minutes ago to ensure it's older than 15
        let dummy_config = serde_json::json!({
            "gameMap": "Regression Test Map",
            "gameType": "Public", 
            "difficulty": "Medium",
            "maxPlayers": 10
        });
        
        sqlx::query!(
            "INSERT INTO lobbies (game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec, completed, lobby_config_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)",
            game_id,
            0, // FFA
            10,
            "Regression Test Map",
            8,
            fifteen_min_ago, // first_seen
            fifteen_min_ago, // last_seen (16 minutes ago)
            dummy_config
        )
        .execute(&pool)
        .await
        .unwrap();

        // Verify the game is initially unfinished
        let initial_lobby = sqlx::query!("SELECT completed FROM lobbies WHERE game_id = $1", game_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(initial_lobby.completed, false);

        // Create a mocked API that returns finished game JSON
        let mut mocked_api = MockOpenFrontAPI::new();
        mocked_api.expect_get_game_json()
            .with(mockall::predicate::eq(game_id))
            .return_once(|_game_id| async move {
                let dir = include_dir::include_dir!("$CARGO_MANIFEST_DIR/examples/gamedata");
                let file = dir.get_file("mygame.json")
                    .expect("mygame.json fixture should exist for regression test");
                let json: serde_json::Value = serde_json::from_slice(file.contents())
                    .expect("Failed to parse mygame.json in regression test");
                Ok(json)
            }.boxed());

        // Use timeout to run one iteration of the finished games loop
        // This ensures we don't get stuck in an infinite loop during testing
        let timeout_duration = tokio::time::Duration::from_secs(10);
        let result = tokio::time::timeout(
            timeout_duration,
            look_for_finished_games_single_iteration(&mocked_api, pool.clone())
        ).await;

        // Verify the timeout didn't occur and the function succeeded
        assert!(result.is_ok(), "Function should complete within timeout");
        let processed_count = result.unwrap().unwrap();
        assert_eq!(processed_count, 1, "Should process exactly 1 game");

        // Assert: Database should now be updated - lobby marked as completed
        let updated_lobby = sqlx::query!("SELECT completed FROM lobbies WHERE game_id = $1", game_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(updated_lobby.completed, true, "Game should be marked as completed after processing");

        // Assert: finished_games table should have the new entry
        let finished_game = sqlx::query!(
            "SELECT game_id, is_ok FROM finished_games WHERE game_id = $1",
            game_id
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(finished_game.game_id, game_id);
        assert_eq!(finished_game.is_ok, true, "Game should be marked as successfully finished");
    }

    #[sqlx::test] 
    async fn test_look_for_finished_games_no_old_games(pool: PgPool) {
        let game_id = "newgame1";
        
        // Insert a recent unfinished game (only 5 minutes old, not 15+ minutes)
        let five_min_ago = now_unix_sec() - (5 * 60); // 5 minutes ago
        let dummy_config = serde_json::json!({
            "gameMap": "Recent Test Map",
            "gameType": "Public",
            "difficulty": "Easy", 
            "maxPlayers": 20
        });
        
        sqlx::query!(
            "INSERT INTO lobbies (game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec, completed, lobby_config_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)",
            game_id,
            0, // FFA
            20,
            "Recent Test Map",
            12,
            five_min_ago, // first_seen
            five_min_ago, // last_seen (only 5 minutes ago)
            dummy_config
        )
        .execute(&pool)
        .await
        .unwrap();

        // Create a mocked API (shouldn't be called since no games are old enough)
        let mocked_api = MockOpenFrontAPI::new();
        // No expectations set - if called, test will fail

        // Run one iteration - should process 0 games since none are old enough
        let processed_count = look_for_finished_games_single_iteration(&mocked_api, pool.clone())
            .await
            .unwrap();
        assert_eq!(processed_count, 0, "Should process 0 games since none are old enough");

        // Game should still be unfinished
        let lobby = sqlx::query!("SELECT completed FROM lobbies WHERE game_id = $1", game_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(lobby.completed, false, "Recent game should remain unfinished");

        // No entries should be in finished_games
        let finished_count = sqlx::query!(
            "SELECT COUNT(*) as count FROM finished_games WHERE game_id = $1",
            game_id
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(finished_count.count.unwrap_or(0), 0, "No finished games should be recorded");
    }
}
