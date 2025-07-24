//
// This is the database schema for the analysis tables.
// CREATE TABLE analysis_1.completed_analysis (
//    game_id CHAR(8) NOT NULL PRIMARY KEY,
//    inserted_at_unix_sec BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
//    analysis_engine_version TEXT NOT NULL,
//    FOREIGN KEY (game_id) REFERENCES public.finished_games(game_id) ON DELETE CASCADE
// );
//
// CREATE TYPE analysis_1.player_type AS ENUM (
//    'BOT',
//    'FAKEHUMAN',
//    'HUMAN'
// );
//
// CREATE TABLE analysis_1.players (
//    game_id CHAR(8) NOT NULL,
//    id CHAR(8) NOT NULL,
//    client_id CHAR(8),
//    small_id SMALLINT NOT NULL,
//    player_type analysis_1.player_type NOT NULL,
//    name TEXT NOT NULL,
//    flag TEXT,
//    team SMALLINT,
//    FOREIGN KEY (game_id) REFERENCES public.finished_games(game_id) ON DELETE CASCADE,
//    PRIMARY KEY (game_id, id)
// );
//
// CREATE TABLE analysis_1.display_events (
//   game_id CHAR(8) NOT NULL,
//   tick SMALLINT NOT NULL,
//   message_type TEXT NOT NULL,
//   message TEXT NOT NULL,
//   player_id SMALLINT NOT NULL,
//   gold_amount INTEGER,
//   FOREIGN KEY (game_id) REFERENCES public.finished_games(game_id) ON DELETE CASCADE
// );
//
// CREATE TYPE analysis_1.event_type AS ENUM (
//   'Tile',
//   'Unit',
//   'Player',
//   'DisplayEvent',
//   'DisplayChatEvent',
//   'AllianceRequest',
//   'AllianceRequestReply',
//   'BrokeAlliance',
//   'AllianceExpired',
//   'AllianceExtension',
//   'TargetPlayer',
//   'Emoji',
//   'Win',
//   'Hash',
//   'UnitIncoming',
//   'BonusEvent',
//   'RailroadEvent'
// );
//
// CREATE TABLE analysis_1.general_events (
//   game_id CHAR(8) NOT NULL,
//   tick SMALLINT NOT NULL,
//   event_type analysis_1.event_type NOT NULL,
//   data JSONB NOT NULL,
//   FOREIGN KEY (game_id) REFERENCES public.finished_games(game_id) ON DELETE CASCADE
// );
//
// CREATE TABLE analysis_1.spawn_locations (
//     game_id CHAR(8) NOT NULL,
//     tick SMALLINT NOT NULL,
//     client_id CHAR(8) NOT NULL,
//     x INTEGER NOT NULL,
//     y INTEGER NOT NULL,
//     previous_spawns JSONB DEFAULT '[]',
//     PRIMARY KEY (game_id, client_id),
//     FOREIGN KEY (game_id) REFERENCES public.finished_games(game_id) ON DELETE CASCADE
// );
//
//
// -- These tables are a follow up from the original analysis_1.player_updates.
// -- The goal is to store less data.
//
// -- one game = 3 stages @ 10 ticks per second
// ---   - 50 player for 10 minutes:
// --         about 50 players, 1 update per second, 6000 ticks = 300,000 rows
// --    - 10 players for 20 minutes
// --         about 10 players, 1 update per second, 1200 ticks = 12,000 rows
// --    - 3 players for 30 minutes
// --         about 3 players, 1 update per second, 1800 ticks = 5,400 rows
// -- 8+2+2+2+2+2+2= = 19/20 bytes per row per update
// -- 300,000 * 20b = 6,000,000 bytes = 6MB per game ish of analysis data
// CREATE TABLE analysis_1.packed_player_updates (
//    game_id CHAR(8) NOT NULL, -- 8 bytes
//    small_id SMALLINT NOT NULL, -- 2 bytes (could be BIT(12)? would that be faster?)
//    tick SMALLINT NOT NULL, -- 2 bytes
//    player_alive BIT(1) NOT NULL, -- 1 bit
//    player_connected BIT(1) NOT NULL, -- 1 bit
//    tiles_owned SMALLINT NOT NULL DEFAULT 0, -- 2 bytes
//    gold  SMALLINT NOT NULL DEFAULT 0, -- 2 bytes
//    workers SMALLINT NOT NULL DEFAULT 0, -- 2 bytes
//    troops SMALLINT NOT NULL DEFAULT 0, -- 2 bytes
//    FOREIGN KEY (game_id) REFERENCES public.finished_games(game_id) ON DELETE CASCADE,
//    PRIMARY KEY (game_id, tick, small_id)
// );
//
// -- When a user changes their target troop ratio, we want to store that. Cause
// -- it's uncommon, we don't want to store it for every frame like before
// CREATE TABLE analysis_1.troop_ratio_change (
//    game_id CHAR(8) NOT NULL,
//    small_id SMALLINT NOT NULL,
//    client_id CHAR(8) NOT NULL,
//    target_troop_ratio REAL NOT NULL
// );

use std::collections::HashMap;

use futures::StreamExt;
use schemars::JsonSchema;
use sqlx::PgPool;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
pub struct ResStatsOverGame {
    pub player_stats_ticks: HashMap<u16, PlayerStatsOnTick>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
struct PlayerStatsOnTick {
    client_id: Option<String>,
    name: String,
    tiles_owned: i16,
    gold: i16,
    workers: i16,
    troops: i16,
}

// Other palyer fields
//    game_id CHAR(8) NOT NULL,
//    id CHAR(8) NOT NULL,
//    client_id CHAR(8),
//    small_id SMALLINT NOT NULL,
//    player_type analysis_1.player_type NOT NULL,
//    name TEXT NOT NULL,
//    flag TEXT,
//    team SMALLINT,
//    FOREIGN KEY (game_id) REFERENCES public.finished_games(game_id) ON DELETE CASCADE,
//    PRIMARY KEY (game_id, id)
pub async fn get_troops_over_game(db: PgPool, game_id: &str) -> anyhow::Result<ResStatsOverGame> {
    let mut res = sqlx::query!(
        r#"
        SELECT
            ply_upds.tick,
            ply_upds.tiles_owned,
            ply_upds.gold,
            ply_upds.workers,
            ply_upds.troops,
            plys.client_id,
            plys.name
        FROM
            analysis_1.packed_player_updates ply_upds
            JOIN analysis_1.players plys
            ON
                ply_upds.game_id = plys.game_id
                AND ply_upds.small_id = plys.small_id
        WHERE
            ply_upds.game_id = $1
        "#,
        game_id
    )
    .fetch(&db);

    let mut players_on_tick: HashMap<u16, PlayerStatsOnTick> = HashMap::new();

    while let Some(row) = res.next().await {
        let row = row?;
        let tick = row.tick as u16;

        let player_stats = PlayerStatsOnTick {
            client_id: row.client_id,
            name: row.name,
            tiles_owned: row.tiles_owned,
            gold: row.gold,
            workers: row.workers,
            troops: row.troops,
        };

        players_on_tick.entry(tick).or_insert(player_stats);
    }

    Ok(ResStatsOverGame {
        player_stats_ticks: players_on_tick,
    })
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
pub struct ResGeneralEventsOverGame {
    events: Vec<GeneralEvent>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
struct GeneralEvent {
    tick: u16,
    event_type: String,
    data: serde_json::Value,
}

pub async fn get_general_events_over_game(
    db: PgPool,
    game_id: &str,
) -> anyhow::Result<ResGeneralEventsOverGame> {
    let mut res = sqlx::query!(
        r#"
        SELECT
            tick,
            event_type as "event_type: String",
            data
        FROM
            analysis_1.general_events
        WHERE
            game_id = $1
        "#,
        game_id
    )
    .fetch(&db);

    let mut events = Vec::new();

    while let Some(row) = res.next().await {
        let row = row?;
        let event = GeneralEvent {
            tick: row.tick as u16,
            event_type: row.event_type,
            data: row.data,
        };
        events.push(event);
    }

    Ok(ResGeneralEventsOverGame { events })
}
