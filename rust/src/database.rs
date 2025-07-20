//! Database-related structures and implementations

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row, postgres::PgRow};
use std::fmt::Display;

use crate::database::player_teams::PlayerTeams;

mod player_teams;

/// Enum representing a value that can be either a string or an integer
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
#[serde(untagged)]
pub enum StringOrInt {
    String(String),
    Int(i32),
}

impl Display for StringOrInt {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StringOrInt::String(s) => write!(f, "{s}"),
            StringOrInt::Int(i) => write!(f, "{i}"),
        }
    }
}

/// Game configuration structure representing lobby settings
/// To get the teams configurtion in rust, use [`Self::teams`]
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, sqlx::FromRow, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct GameConfig {
    pub game_map: String,
    pub game_type: String,
    pub difficulty: String,
    #[serde(rename = "disableNPCs")]
    pub disable_npcs: bool,
    pub infinite_gold: bool,
    pub infinite_troops: bool,
    pub instant_build: bool,
    pub game_mode: String,
    pub bots: i32,
    pub disabled_units: Vec<String>,
    pub max_players: i32,
    pub player_teams: Option<StringOrInt>,
}

impl GameConfig {
    pub fn teams(&self) -> PlayerTeams {
        if let Some(ref teams) = self.player_teams {
            // Teams is either a string like Quads, Duos or a number like 4
            PlayerTeams::from_str_or_int(teams).unwrap()
        } else {
            /// teams: null = FFA
            PlayerTeams::FFA
        }
    }
}

/// Database entry for lobby information including configuration
/// used in list lobby by id
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, sqlx::FromRow, JsonSchema)]
pub struct APIGetLobbyWithConfig {
    pub game_id: String,
    pub teams: PlayerTeams,
    pub max_players: i32,
    pub game_map: String,
    pub approx_num_players: i32,
    /// Last seen timestamp in seconds
    pub first_seen_unix_sec: i64,
    /// Last seen timestamp in seconds
    pub last_seen_unix_sec: i64,
    pub completed: bool,
    pub lobby_config_json: serde_json::Value,
    pub analysis_complete: bool,
}

/// Database entry for lobby information without used in the list lobbies API
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, sqlx::FromRow, JsonSchema)]
pub struct APIGetLobby {
    pub game_id: String,
    pub teams: PlayerTeams,
    pub max_players: i32,
    pub game_map: String,
    pub approx_num_players: i32,
    /// Last seen timestamp in seconds
    pub first_seen_unix_sec: i64,
    /// Last seen timestamp in seconds
    pub last_seen_unix_sec: i64,
    pub completed: bool,
    pub analysis_complete: bool,
}

impl<'a> sqlx::FromRow<'a, sqlx::postgres::PgRow> for APIGetLobby {
    fn from_row(row: &'a sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        use sqlx::Row;
        let teams_val: i32 = row.try_get("teams")?;
        let teams = PlayerTeams::from(teams_val);

        Ok(APIGetLobby {
            game_id: row.try_get("game_id")?,
            teams,
            max_players: row.try_get("max_players")?,
            game_map: row.try_get("game_map")?,
            approx_num_players: row.try_get("approx_num_players")?,
            first_seen_unix_sec: row.try_get("first_seen_unix_sec")?,
            last_seen_unix_sec: row.try_get("last_seen_unix_sec")?,
            completed: row.try_get("completed")?,
            // This field must be joined from the analysis table
            analysis_complete: row.try_get("analysis_complete!")?,
        })
    }
}

impl APIGetLobbyWithConfig {
    pub fn lobby_config(&self) -> GameConfig {
        serde_json::from_value(self.lobby_config_json.clone())
            .expect("Invalid lobby config JSON in database")
    }
}

/// Enum representing the status of analysis queue entries: TODO implement all these
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema, sqlx::Type)]
#[sqlx(type_name = "analysis_queue_status")]
pub enum AnalysisQueueStatus {
    Pending,
    Running,
    Completed,
    NotFound,
    Failed,
    Stalled,
    Cancelled,
    CompletedAlready,
}

/// Database entry for finished games
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
pub struct APIFinishedGame {
    pub game_id: String,
    pub result_json: serde_json::Value,
    pub inserted_at_unix_sec: i64,
}

/// Returns the current Unix timestamp in seconds
pub fn now_unix_sec() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("System time before UNIX EPOCH")
        .as_secs() as i64
}
