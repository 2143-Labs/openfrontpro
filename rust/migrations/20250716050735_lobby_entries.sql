-- Add migration script here
-- struct LobbyDBEntry {
--     game_id: String,
--     teams: Option<u32>,
--     max_players: u32,
--     game_map: String,
--     approx_num_players: u32,
--     first_seen_unix_sec: u64, // Unix timestamp in seconds
-- }

CREATE TABLE IF NOT EXISTS lobbies (
    game_id TEXT PRIMARY KEY,
    teams INTEGER,
    max_players INTEGER NOT NULL,
    game_map TEXT NOT NULL,
    approx_num_players INTEGER NOT NULL,
    first_seen_unix_sec bigint NOT NULL,
    last_seen_unix_sec bigint NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS finished_games (
    game_id TEXT PRIMARY KEY,
    result_json JSONB NOT NULL
);
