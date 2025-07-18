CREATE SCHEMA analysis_1;

CREATE TABLE analysis_1.completed_analysis (
   game_id CHAR(8) NOT NULL PRIMARY KEY,
   inserted_at_unix_sec BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
   analysis_engine_version TEXT NOT NULL,
   FOREIGN KEY (game_id) REFERENCES public.lobbies(game_id) ON DELETE CASCADE
);

CREATE TABLE analysis_1.player_updates (
   game_id CHAR(8) NOT NULL,
   id CHAR(8) NOT NULL,
   tick SMALLINT NOT NULL,
   player_status SMALLINT NOT NULL,
   tiles_owned INTEGER NOT NULL DEFAULT 0,
   gold INTEGER NOT NULL DEFAULT 0,
   workers INTEGER NOT NULL DEFAULT 0,
   troops INTEGER NOT NULL DEFAULT 0,
   target_troop_ratio SMALLINT NOT NULL,
   FOREIGN KEY (game_id) REFERENCES public.lobbies(game_id) ON DELETE CASCADE,
   PRIMARY KEY (game_id, id, tick)
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
