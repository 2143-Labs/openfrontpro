-- These tables are a follow up from the original analysis_1.player_updates.
-- The goal is to store less data.

-- one game = 3 stages @ 10 ticks per second
---   - 50 player for 10 minutes:
--         about 50 players, 1 update per second, 6000 ticks = 300,000 rows
--    - 10 players for 20 minutes
--         about 10 players, 1 update per second, 1200 ticks = 12,000 rows
--    - 3 players for 30 minutes
--         about 3 players, 1 update per second, 1800 ticks = 5,400 rows
-- 8+2+2+2+2+2+2= = 19/20 bytes per row per update
-- 300,000 * 20b = 6,000,000 bytes = 6MB per game ish of analysis data
CREATE TABLE analysis_1.packed_player_updates (
   game_id CHAR(8) NOT NULL, -- 8 bytes
   small_id SMALLINT NOT NULL, -- 2 bytes (could be BIT(12)? would that be faster?)
   tick SMALLINT NOT NULL, -- 2 bytes
   player_alive BIT(1) NOT NULL, -- 1 bit
   player_connected BIT(1) NOT NULL, -- 1 bit
   tiles_owned SMALLINT NOT NULL DEFAULT 0, -- 2 bytes
   gold  SMALLINT NOT NULL DEFAULT 0, -- 2 bytes
   workers SMALLINT NOT NULL DEFAULT 0, -- 2 bytes
   troops SMALLINT NOT NULL DEFAULT 0, -- 2 bytes
   FOREIGN KEY (game_id) REFERENCES public.finished_games(game_id) ON DELETE CASCADE,
   PRIMARY KEY (game_id, tick, small_id)
);

-- When a user changes their target troop ratio, we want to store that. Cause
-- it's uncommon, we don't want to store it for every frame like before
CREATE TABLE analysis_1.troop_ratio_change (
   game_id CHAR(8) NOT NULL,
   small_id SMALLINT NOT NULL,
   client_id CHAR(8) NOT NULL,
   target_troop_ratio REAL NOT NULL
);

CREATE TABLE social.discord_link (
   user_id CHAR(10) NOT NULL PRIMARY KEY,
   discord_user_id TEXT NOT NULL UNIQUE,
   discord_username TEXT NOT NULL,
   discord_discriminator TEXT,
   discord_avatar TEXT,
   created_at_unix_sec BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);
