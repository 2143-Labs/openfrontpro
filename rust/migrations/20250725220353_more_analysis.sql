-- Add migration script here

CREATE TABLE IF NOT EXISTS social.tracked_openfront_players (
    openfront_player_id TEXT NOT NULL PRIMARY KEY,
    is_tracking BOOLEAN NOT NULL DEFAULT TRUE,
    last_check_unix_sec BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW() - INTERVAL '1 day')

);

CREATE TABLE IF NOT EXISTS social.tracked_player_in_game (
    openfront_player_id TEXT NOT NULL,
    game_id CHAR(8) NOT NULL,
    client_id CHAR(8) NOT NULL,
    PRIMARY KEY (openfront_player_id, game_id, client_id),
    FOREIGN KEY (openfront_player_id) REFERENCES social.tracked_openfront_players(openfront_player_id) ON DELETE CASCADE
    -- FOREIGN KEY (game_id) REFERENCES public.finished_games(game_id),
    -- FOREIGN KEY client_id REFERENCES analysis_1.players(client_id)
);

CREATE TABLE IF NOT EXISTS config (
    key TEXT NOT NULL PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);
