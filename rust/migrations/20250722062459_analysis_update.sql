-- These tables are a follow up from the original analysis_1.player_updates.
-- The goal is to store less data.


-- This table is used to map small_id to client_id for player updates.
CREATE TABLE analysis_1.player_updates_small_id_mapping (
   game_id CHAR(8) NOT NULL,
   small_id SMALLINT NOT NULL,
   client_id CHAR(8) NOT NULL,
   PRIMARY KEY (game_id, small_id)
);


-- When a user changes their target troop ratio, we want to store that. Cause
-- it's uncommon, we don't want to store it for every frame
CREATE TABLE analysis_1.troop_ratio_change (
   game_id CHAR(8) NOT NULL,
   small_id SMALLINT NOT NULL,
   client_id CHAR(8) NOT NULL,
   target_troop_ratio REAL NOT NULL
);

-- 8+2+2+2+4+4+2+2 = 26 bytes per row
-- one game = 3 stages @ 10 ticks per second
---   - 50 player for 10 minutes:
--         about 50 players, 10 update per second, 6000 ticks = 3,000,000 rows
--    - 10 players for 20 minutes
--         about 10 players, 10 update per second, 1200 ticks = 120,000 rows
--    - 3 players for 30 minutes
--         about 3 players, 10 update per second, 1800 ticks = 54,000 rows
--
-- Things to note: Most of the data is at the start. Average game will end up with
-- about 3M rows which @ 26 bytes per row is about 78MB.
-- If we have 50 registered users games per day, that is about 3.9GB per day.
-- That should last at least one month with current db?
CREATE TABLE analysis_1.packed_player_updates (
   game_id CHAR(8) NOT NULL, -- 8 bytes
   small_id SMALLINT NOT NULL, -- 2 bytes
   tick SMALLINT NOT NULL, -- 2 bytes
   player_status SMALLINT NOT NULL, -- 2 bytes
   tiles_owned INTEGER NOT NULL DEFAULT 0, -- 4 bytes
   gold INTEGER NOT NULL DEFAULT 0, -- 4 bytes
   workers_thousands SMALLINT NOT NULL DEFAULT 0, -- 2 bytes
   troops_thousands NOT NULL DEFAULT 0, -- 2 bytes
   FOREIGN KEY (game_id) REFERENCES public.finished_games(game_id) ON DELETE CASCADE,
   PRIMARY KEY (game_id, tick, small_id)
);
