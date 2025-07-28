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
    pub player_stats_ticks: HashMap<u16, Vec<PlayerStatsOnTick>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
pub struct PlayerStatsOnTick {
    client_id: Option<String>,
    name: String,
    tiles_owned: u64,
    gold: u64,
    workers: u64,
    troops: u64,
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

    let mut players_on_tick: HashMap<u16, Vec<PlayerStatsOnTick>> = HashMap::new();

    while let Some(row) = res.next().await {
        let row = row?;
        let tick = row.tick as u16;

        let player_stats = PlayerStatsOnTick {
            client_id: row.client_id,
            name: row.name,
            tiles_owned: super::decompress_value_from_db(row.tiles_owned),
            gold: super::decompress_value_from_db(row.gold),
            workers: super::decompress_value_from_db(row.workers) / 10,
            troops: super::decompress_value_from_db(row.troops) / 10,
        };

        players_on_tick
            .entry(tick)
            .and_modify(|v| v.push(player_stats.clone()))
            .or_insert_with(|| vec![player_stats]);
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

pub async fn get_display_events_over_game(
    db: PgPool,
    game_id: &str,
) -> anyhow::Result<ResDisplayEventsOverGame> {
    let mut res = sqlx::query!(
        r#"
        SELECT
            de.tick,
            de.message_type,
            de.message,
            de.player_id as "small_id: i16",
            de.gold_amount,
            ply.client_id,
            ply.name
        FROM
            analysis_1.display_events de
            JOIN analysis_1.players ply
                ON de.game_id = ply.game_id
                AND de.player_id = ply.small_id
        WHERE
            de.game_id = $1
        ORDER BY tick, player_id
        "#,
        game_id
    )
    .fetch(&db);

    let mut events = Vec::new();

    while let Some(row) = res.next().await {
        let row = row?;
        let event = DisplayEvent {
            tick: row.tick as u16,
            message_type: row.message_type,
            message: row.message,
            small_id: row.small_id as u16,
            client_id: row.client_id,
            name: row.name,
            gold_amount: row.gold_amount,
        };
        events.push(event);
    }

    Ok(ResDisplayEventsOverGame { events })
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
pub struct ResDisplayEventsOverGame {
    pub events: Vec<DisplayEvent>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
pub struct DisplayEvent {
    pub tick: u16,
    pub message_type: String,
    pub message: String,
    pub small_id: u16,
    pub gold_amount: Option<i32>,
    pub client_id: Option<String>,
    pub name: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
pub struct ResPlayer {
    players: Vec<GamePlayer>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
struct GamePlayer {
    //     from analysis_1.players
    //game_id CHAR(8) NOT NULL,
    //id CHAR(8) NOT NULL,
    //client_id CHAR(8),
    //small_id SMALLINT NOT NULL,
    //player_type analysis_1.player_type NOT NULL,
    //name TEXT NOT NULL,
    //flag TEXT,
    //team SMALLINT,
    id: String,
    client_id: Option<String>,
    small_id: u16,
    player_type: String,
    name: String,
    flag: Option<String>,
    team: Option<i16>,

    //     from analysis_1.spawn_locations
    //     game_id CHAR(8) NOT NULL,
    //     tick SMALLINT NOT NULL, //spawn_selection_tick
    //     client_id CHAR(8) NOT NULL,
    //     x INTEGER NOT NULL,
    //     y INTEGER NOT NULL,
    //     previous_spawns JSONB DEFAULT '[]',
    spawn_info: Option<SpawnInfo>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
struct SpawnInfo {
    tick: u16,
    x: i32,
    y: i32,
    previous_spawns: serde_json::Value, // JSONB
}

// This is going to return both the players and their spawn locations
pub async fn get_game_players(db: PgPool, game_id: &str) -> anyhow::Result<ResPlayer> {
    let mut res = sqlx::query!(
        r#"
        SELECT
            p.id,
            p.client_id,
            p.small_id,
            p.player_type as "player_type: String",
            p.name,
            p.flag,
            p.team,
            s.tick as "spawn_tick: Option<i16>",
            s.x as "spawn_x: Option<i32>",
            s.y as "spawn_y: Option<i32>",
            s.previous_spawns as "previous_spawns: serde_json::Value"
        FROM
            analysis_1.players p
            LEFT JOIN analysis_1.spawn_locations s
                ON  p.game_id = s.game_id
                AND p.client_id = s.client_id
        WHERE
            p.game_id = $1
        "#,
        game_id
    )
    .fetch(&db);

    let mut players = Vec::new();

    while let Some(row) = res.next().await {
        let row = row?;
        let spawn_info =
            if let (Some(tick), Some(x), Some(y)) = (row.spawn_tick, row.spawn_x, row.spawn_y) {
                Some(SpawnInfo {
                    tick: tick as u16,
                    x,
                    y,
                    previous_spawns: row.previous_spawns.unwrap_or(serde_json::Value::Null),
                })
            } else {
                None
            };

        let player = GamePlayer {
            id: row.id,
            client_id: row.client_id,
            small_id: row.small_id as u16,
            player_type: row.player_type,
            name: row.name,
            flag: row.flag,
            team: row.team.map(|t| t as i16),
            spawn_info,
        };
        players.push(player);
    }

    Ok(ResPlayer { players })
}
