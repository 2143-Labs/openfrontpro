//! Database-related structures and implementations

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row, postgres::PgRow};
use std::fmt::Display;

/// Enum representing different player team configurations in a game
#[derive(Debug, Clone, serde::Serialize, JsonSchema)]
#[serde(tag = "group")]
pub enum PlayerTeams {
    Ffa,
    Teams { num_teams: u8 },
    Parties { party_size: u8 },
}

impl PlayerTeams {
    pub fn from_str_or_int(s: &StringOrInt) -> Option<Self> {
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
            PlayerTeams::Ffa
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
            PlayerTeams::Ffa => 0,
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
            PlayerTeams::Ffa => write!(f, "FFA"),
            PlayerTeams::Teams { num_teams } => write!(f, "{num_teams} Teams"),
            PlayerTeams::Parties { party_size } => write!(f, "Parties of {party_size}"),
        }
    }
}

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
    pub fn player_teams(&self) -> PlayerTeams {
        if let Some(ref teams) = self.player_teams {
            PlayerTeams::from_str_or_int(teams).unwrap()
        } else {
            PlayerTeams::Ffa
        }
    }
}

/// Database entry for lobby information including configuration
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, sqlx::FromRow, JsonSchema)]
pub struct LobbyDBEntry {
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

/// Database entry for lobby information without configuration JSON
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, sqlx::FromRow, JsonSchema)]
pub struct LobbyDBEntryNoConfig {
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

impl<'a> sqlx::FromRow<'a, sqlx::postgres::PgRow> for LobbyDBEntryNoConfig {
    fn from_row(row: &'a sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
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

/// Enum representing the status of analysis queue items
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
pub struct FinshedGameDBEntry {
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
