-- Initial Migration

CREATE SCHEMA IF NOT EXISTS public;

-- Lobby Listeners

CREATE TABLE IF NOT EXISTS lobbies (
    game_id CHAR(8) PRIMARY KEY,
    teams INTEGER NOT NULL,
    max_players INTEGER NOT NULL,
    game_map TEXT NOT NULL,
    approx_num_players INTEGER NOT NULL,
    first_seen_unix_sec bigint NOT NULL,
    last_seen_unix_sec bigint NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    lobby_config_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS finished_games (
    game_id CHAR(8) PRIMARY KEY,
    result_json JSONB NOT NULL,
    is_ok BOOLEAN NOT NULL DEFAULT TRUE,
    inserted_at_unix_sec bigint NOT NULL DEFAULT extract(epoch from NOW()),
    FOREIGN KEY (game_id) REFERENCES lobbies(game_id) ON DELETE CASCADE
);

-- Game Analysis

CREATE SCHEMA analysis_1;

CREATE TABLE analysis_1.completed_analysis (
   game_id CHAR(8) NOT NULL PRIMARY KEY,
   inserted_at_unix_sec BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
   analysis_engine_version TEXT NOT NULL,
   FOREIGN KEY (game_id) REFERENCES public.lobbies(game_id) ON DELETE CASCADE
);

CREATE TYPE analysis_1.player_type AS ENUM (
   'BOT',
   'FAKEHUMAN',
   'HUMAN'
);

CREATE TABLE analysis_1.players (
   game_id CHAR(8) NOT NULL,
   id CHAR(8) NOT NULL,
   client_id CHAR(8),
   small_id SMALLINT NOT NULL,
   player_type analysis_1.player_type NOT NULL,
   name TEXT NOT NULL,
   flag TEXT,
   team SMALLINT,
   FOREIGN KEY (game_id) REFERENCES public.lobbies(game_id) ON DELETE CASCADE,
   PRIMARY KEY (game_id, id)
);

CREATE TABLE analysis_1.player_updates (
   game_id CHAR(8) NOT NULL,
   id CHAR(8) NOT NULL,
   small_id SMALLINT NOT NULL,
   tick SMALLINT NOT NULL,
   player_status SMALLINT NOT NULL,
   tiles_owned INTEGER NOT NULL DEFAULT 0,
   gold INTEGER NOT NULL DEFAULT 0,
   workers INTEGER NOT NULL DEFAULT 0,
   troops INTEGER NOT NULL DEFAULT 0,
   --- from 0-1000
   target_troop_ratio SMALLINT NOT NULL,
   FOREIGN KEY (game_id) REFERENCES public.lobbies(game_id) ON DELETE CASCADE,
   PRIMARY KEY (game_id, tick, small_id)
);

CREATE TABLE analysis_1.display_events (
  game_id CHAR(8) NOT NULL,
  tick SMALLINT NOT NULL,
  message_type TEXT NOT NULL,
  message TEXT NOT NULL,
  player_id SMALLINT NOT NULL,
  gold_amount INTEGER,
  FOREIGN KEY (game_id) REFERENCES public.lobbies(game_id) ON DELETE CASCADE
);

CREATE TYPE analysis_1.event_type AS ENUM (
  'Tile',
  'Unit',
  'Player',
  'DisplayEvent',
  'DisplayChatEvent',
  'AllianceRequest',
  'AllianceRequestReply',
  'BrokeAlliance',
  'AllianceExpired',
  'AllianceExtension',
  'TargetPlayer',
  'Emoji',
  'Win',
  'Hash',
  'UnitIncoming',
  'BonusEvent',
  'RailroadEvent'
);

CREATE TABLE analysis_1.general_events (
  game_id CHAR(8) NOT NULL,
  tick SMALLINT NOT NULL,
  event_type analysis_1.event_type NOT NULL,
  data JSONB NOT NULL,
  FOREIGN KEY (game_id) REFERENCES public.lobbies(game_id) ON DELETE CASCADE
);

CREATE TABLE analysis_1.spawn_locations (
    game_id CHAR(8) NOT NULL,
    client_id CHAR(8) NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    previous_spawns JSONB DEFAULT '[]',
    PRIMARY KEY (game_id, client_id),
    FOREIGN KEY (game_id) REFERENCES public.lobbies(game_id) ON DELETE CASCADE
);

