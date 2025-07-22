async function runSimulation(runner, record, analysis, pool, extraData) {
    runner.init();
    let simulation_turns_left = -1;
    for (const turn of record.turns) {
        await analyze_intents(turn, pool, record, analysis);
        runner.addTurn(turn);
        runner.executeNextTick();
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (simulation_turns_left === 0) {
            console.log("Player has won, stopping simulation.");
            break;
        } else if (simulation_turns_left > 0) {
            console.log("Simulation turns left: ", simulation_turns_left);
            simulation_turns_left--;
        }
    }
    return analysis;
}

// Utility to format SQL queries
function formatSql(strings: TemplateStringsArray, ...values: any[]): string {
    return strings.reduce(
        (acc, str, index) => acc + str + (values[index] || ""),
        "",
    );
}

// ===== Imports =====
import { getServerConfig } from "openfront-client/src/core/configuration/ConfigLoader.ts";
import { DefaultConfig } from "openfront-client/src/core/configuration/DefaultConfig.ts";
import { Executor } from "openfront-client/src/core/execution/ExecutionManager.ts";
import {
    Cell,
    GameMapType,
    MessageType,
    Nation,
    PlayerInfo,
    PlayerType,
    UnitType,
} from "openfront-client/src/core/game/Game.ts";
import { createGame } from "openfront-client/src/core/game/GameImpl.ts";
import { GameMapImpl } from "openfront-client/src/core/game/GameMap.ts";
import {
    ErrorUpdate,
    GameUpdateType,
    PlayerUpdate,
    UnitUpdate,
    type DisplayMessageUpdate,
    type GameUpdate,
    type GameUpdateViewData,
} from "openfront-client/src/core/game/GameUpdates.ts";
import { PseudoRandom } from "openfront-client/src/core/PseudoRandom.ts";
//import { type TerrainMapData } from "openfront-client/src/core/game/TerrainMapLoader.ts";
import { GameRunner } from "openfront-client/src/core/GameRunner.ts";
import { Turn, type GameRecord } from "openfront-client/src/core/Schemas.ts";
import {
    decompressGameRecord,
    simpleHash,
} from "openfront-client/src/core/Util.ts";

import { Logger } from "winston";

import fs from "fs/promises";
import { Pool } from "pg";

// ===== Constants / Types =====
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
}

type MapData = {
    minimap: Uint8Array;
    map: Uint8Array;
    manifest: any;
};

type PlayerSpawn = {
    turn: number;
    x: number;
    y: number;
    previous_spawns: PlayerSpawn[];
};

type Analysis = {
    gameId: string;
    players: PlayerInfo[];
    spawns: Record<string, PlayerSpawn>;
};

type ExtraData = {
    players_died_on_turn: Record<string, number>;
    players_disconnected_on_turn: Record<string, number>;
    players_troop_ratio: Record<string, number>;
};

// ===== Database helpers =====

const INSERT_SPAWN_LOCATIONS = formatSql`
  INSERT INTO analysis_1.spawn_locations (game_id, client_id, tick, x, y, previous_spawns)
  VALUES ($1, $2, $3, $4, $5, $6)
`;

const UPSERT_COMPLETED_ANALYSIS = formatSql`
  INSERT INTO analysis_1.completed_analysis (game_id, analysis_engine_version)
  VALUES ($1, $2)
  ON CONFLICT (game_id) DO UPDATE
  SET inserted_at_unix_sec = EXTRACT(EPOCH FROM NOW()),
      analysis_engine_version = $2
`;

const INSERT_DISPLAY_EVENT = formatSql`
  INSERT INTO
    analysis_1.display_events (game_id, tick, message_type, message, player_id, gold_amount)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING tick
`;

const INSERT_PLAYER = formatSql`
  INSERT INTO
    analysis_1.players (
      game_id, id, client_id, small_id, player_type, name, flag, team
    )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

//const INSERT_PLAYER_UPDATE_OLD = formatSql`
  //INSERT INTO
    //analysis_1.player_updates (game_id, id, player_status, small_id, tiles_owned, gold, workers, troops, target_troop_ratio, tick)
  //VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  //RETURNING tick
//`;

const INSERT_GENERAL_EVENT = formatSql`
  INSERT INTO
    analysis_1.general_events (game_id, tick, event_type, data)
  VALUES ($1, $2, $3, $4)
  RETURNING tick
`;

const SELECT_AND_UPDATE_JOB = formatSql`
  WITH my_job AS (
    SELECT
      fg.game_id, fg.result_json
    FROM
      finished_games fg
    INNER JOIN analysis_queue aq ON aq.game_id = fg.game_id
    WHERE
      aq.status = 'Pending'
    LIMIT 1
  )
  UPDATE analysis_queue aq
  SET
    status = 'Running',
    started_unix_sec = EXTRACT(EPOCH FROM NOW())
  FROM my_job
  WHERE aq.game_id = my_job.game_id
  RETURNING my_job.game_id, my_job.result_json
`;

const UPDATE_ANALYSIS_QUEUE_STATUS = formatSql`
  UPDATE analysis_queue
  SET
    status = $2
  WHERE game_id = $1
`;

// CREATE TABLE analysis_1.packed_player_updates (
//    game_id CHAR(8) NOT NULL, -- 8 bytes
//    small_id SMALLINT NOT NULL, -- 2 bytes
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
const INSERT_PLAYER_UPDATE_NEW = formatSql`
  INSERT INTO
    analysis_1.packed_player_updates (game_id, small_id, tick, player_alive, player_connected, tiles_owned, gold, workers, troops)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING tick
`;

// -- These tables are a follow up from the original analysis_1.player_updates.
// -- The goal is to store less data.
// 
// -- When a user changes their target troop ratio, we want to store that. Cause
// -- it's uncommon, we don't want to store it for every frame
// CREATE TABLE analysis_1.troop_ratio_change (
//    game_id CHAR(8) NOT NULL,
//    small_id SMALLINT NOT NULL,
//    client_id CHAR(8) NOT NULL,
//    target_troop_ratio REAL NOT NULL
// );
const INSERT_PLAYER_TROOP_RATIO_CHANGE = formatSql`
    INSERT INTO
        analysis_1.troop_ratio_change (game_id, small_id, client_id, target_troop_ratio)
    VALUES ($1, $2, $3, $4)
`;

// Maps a value from the range [0, 1T] to a range of small int: -32768 to 32767
function encode_float_to_u16(value: number | bigint): number {
    const MAX_INPUT = 1_000_000_000_000;
    const U16_MAX = 65535;
    if(value > MAX_INPUT) {
        value = MAX_INPUT;
    } else if(value < 0) {
        console.log("[warn] Cannot encode negative value to u16, setting to 0");
        value = 0;
    }
    if (typeof value === "bigint") {
        value = Number(value);
    }
    const log_max = Math.log10(MAX_INPUT + 1);
    const log_value = Math.log10(value + 1);
    return Math.round((log_value / log_max) * U16_MAX);
}

function turn_u16_to_i16(value: number): number {
    return value - 32768;
}

function compress_value_for_db(value: number | bigint): number {
    return turn_u16_to_i16(encode_float_to_u16(value));
}

// ===== Database cleanup helpers =====
async function cleanupPreviousAnalysis(
    pool: Pool,
    gameId: string,
): Promise<void> {
    const tableNames = [
        "general_events",
        "player_updates",
        "display_events",
        "completed_analysis",
        "players",
        "spawn_locations",
        "packed_player_updates",
        "troop_ratio_change",
    ];

    for (const tableName of tableNames) {
        try {
            const deleteQuery = `DELETE FROM analysis_1.${tableName} WHERE game_id = $1;`;
            await pool.query(deleteQuery, [gameId]);
        } catch (error) {
            throw new Error(`Failed to delete from ${tableName}: ${error}`);
        }
    }
}

// ===== Game setup helpers =====
function game_type_from_name(name: string): GameMapType {
    for (const [k, v] of Object.entries(GameMapType)) {
        if (v === name) {
            return k as GameMapType;
        }
    }
    throw new Error(`Unknown game type: ${name}`);
}

async function load_map_data(
    maps_path: string,
    map_name: string,
): Promise<MapData> {
    //let map_type = game_type_from_name(map_name);
    const map_file_name = map_name.replace(/ /g, "").toLowerCase();

    const map_file = fs.readFile(`${maps_path}/${map_file_name}/map.bin`);
    const mini_map_file = fs.readFile(
        `${maps_path}/${map_file_name}/mini_map.bin`,
    );
    const manifest_file = fs.readFile(
        `${maps_path}/${map_file_name}/manifest.json`,
        { encoding: "utf-8" },
    );

    const [map_data, mini_map_data, manifest_data] = await Promise.all([
        map_file,
        mini_map_file,
        manifest_file,
    ]);
    const manifest = JSON.parse(manifest_data);

    const map = new Uint8Array(map_data);
    const mini_map = new Uint8Array(mini_map_data);

    return {
        minimap: mini_map,
        map: map,
        manifest: manifest,
    };
}

// ===== Game initialization =====
async function initializeGame(
    record: GameRecord,
    gameId: string,
    pool: Pool,
): Promise<{
    game: any;
    runner: GameRunner;
    humans: PlayerInfo[];
    nations: Nation[];
    mapImpl: GameMapImpl;
    miniMapImpl: GameMapImpl;
}> {
    const prod_config = getServerConfig("prod");
    const server_config = new DefaultConfig(
        prod_config,
        record.info.config,
        null,
        true,
    );
    const random = new PseudoRandom(simpleHash(gameId));

    // Load terrain
    const map_data = await load_map_data(
        "./OpenFrontIO/resources/maps",
        record.info.config.gameMap,
    );
    console.log("Map data loaded", map_data.manifest.name);
    const mapImpl = new GameMapImpl(
        map_data.manifest.map.width,
        map_data.manifest.map.height,
        map_data.map,
        map_data.manifest.map.num_land_tiles,
    );

    const miniMapImpl = new GameMapImpl(
        map_data.manifest.mini_map.width,
        map_data.manifest.mini_map.height,
        map_data.minimap,
        map_data.manifest.mini_map.num_land_tiles,
    );

    // Create players and nations
    const humans = record.info.players.map(
        (p) =>
            new PlayerInfo(
                p.username,
                PlayerType.Human,
                p.clientID,
                random.nextID(),
            ),
    );
    let nations = [];
    if (!record.info.config.disableNPCs) {
        nations = map_data.manifest.nations.map((n: any) => {
            const pi = new PlayerInfo(
                n.name,
                PlayerType.FakeHuman,
                null,
                random.nextID(),
            );

            const [x, y] = n.coordinates;
            const nation = new Nation(new Cell(x, y), n.strength, pi);

            return nation;
        });
    }

    const winner = record.info.winner![1];
    console.log("Winner: ", winner);
    const winner_player = humans.find((p) => p.clientID === winner)!;
    console.log("Winner Player: ", winner_player);
    //let winner_id = winner_player.id;
    //process.exit(1)

    const game = createGame(
        humans,
        nations,
        mapImpl,
        miniMapImpl,
        server_config,
    );

    const runner = new GameRunner(
        game,
        new Executor(game, gameId, "openfrontpro"),
        async (gu) => {
            const simulation_turns_left = -1;
            const extra_data: ExtraData = {
                players_died_on_turn: {},
                players_disconnected_on_turn: {},
                players_troop_ratio: {},
            };
            console.log("Extra data is all null now", extra_data);
            const has_won = await handle_game_update(
                gu,
                pool,
                record,
                extra_data,
            );
            if (simulation_turns_left === -1 && has_won) {
                console.log("Player has won, stopping simulation.");
            }
        },
    );

    return { game, runner, humans, nations, mapImpl, miniMapImpl };
}

// ===== Analysis finalization =====
async function finalizeAnalysis(
    pool: Pool,
    analysis: Analysis,
): Promise<Analysis> {
    const gameId = analysis.gameId;

    for (const [client_id, spawn] of Object.entries(analysis.spawns)) {
        if(!spawn.x || !spawn.y) {
            console.log("invalid spawn for client", client_id, "in game", gameId);
            continue;
        }
        await pool.query(INSERT_SPAWN_LOCATIONS, [
            gameId,
            client_id,
            spawn.turn,
            spawn.x,
            spawn.y,
            JSON.stringify(spawn.previous_spawns),
        ]);
    }

    await pool.query(UPSERT_COMPLETED_ANALYSIS, [gameId, "v1"]);

    console.log("Completed analysis for game", gameId);
    return analysis;
}

// ===== Simulation helpers =====
async function simgame(gameId: string, record: GameRecord, p: Pool) {
    const prod_config = getServerConfig("prod");
    const server_config = new DefaultConfig(
        prod_config,
        record.info.config,
        null,
        true,
    );
    const random = new PseudoRandom(simpleHash(gameId));

    // Load terrain
    const map_data = await load_map_data(
        "./OpenFrontIO/resources/maps",
        record.info.config.gameMap,
    );
    console.log("Map data loaded", map_data.manifest.name);
    const map_impl = new GameMapImpl(
        map_data.manifest.map.width,
        map_data.manifest.map.height,
        map_data.map,
        map_data.manifest.map.num_land_tiles,
    );

    const mini_map_impl = new GameMapImpl(
        map_data.manifest.mini_map.width,
        map_data.manifest.mini_map.height,
        map_data.minimap,
        map_data.manifest.mini_map.num_land_tiles,
    );

    // Create players and nations
    const humans = record.info.players.map(
        (p) =>
            new PlayerInfo(
                p.username,
                PlayerType.Human,
                p.clientID,
                random.nextID(),
            ),
    );
    let nations = [];
    if (!record.info.config.disableNPCs) {
        nations = map_data.manifest.nations.map((n: any) => {
            const pi = new PlayerInfo(
                n.name,
                PlayerType.FakeHuman,
                null,
                random.nextID(),
            );

            const [x, y] = n.coordinates;
            const nation = new Nation(new Cell(x, y), n.strength, pi);

            return nation;
        });
    }

    const winner = record.info.winner![1];
    console.log("Winner: ", winner);
    const winner_player = humans.find((p) => p.clientID === winner)!;
    console.log("Winner Player: ", winner_player);
    //let winner_id = winner_player.id;
    //process.exit(1)

    // Simulate the game
    // Clear all tables with this game ID
    await cleanupPreviousAnalysis(p, gameId);

    console.log("Clear complete. Starting analysis.", gameId);

    const game = createGame(
        humans,
        nations,
        map_impl,
        mini_map_impl,
        server_config,
    );

    // This is a mutable object that we pass to every call to handle_game_update
    // Used to store data that we care about between turns, but doesn't make the analysis
    const extra_data: ExtraData = {
        players_died_on_turn: {},
        players_disconnected_on_turn: {},
        players_troop_ratio: {},
    };

    // -1 means unlimited. Game ends at 0;
    let simulation_turns_left = -1;
    const runner = new GameRunner(
        game,
        new Executor(game, gameId, "openfrontpro"),
        async (gu) => {
            const has_won = await handle_game_update(gu, p, record, extra_data);
            if (simulation_turns_left === -1 && has_won) {
                simulation_turns_left = 5;
            }
        },
    );

    const analysis: Analysis = {
        gameId: gameId,
        players: humans,
        spawns: {},
    };

    // Run the simulation
    await runSimulation(runner, record, analysis, p, extra_data);
    console.log("Simulation complete. Finalizing analysis.");

    return await finalizeAnalysis(p, analysis);
}

async function analyze_intents(
    turn: Turn,
    p: Pool,
    record: GameRecord,
    analysis: Analysis,
): Promise<void> {
    for (const intent of turn.intents) {
        if (intent.type !== "spawn") {
            continue;
        }

        const client_id = intent.clientID;
        const x = intent.x;
        const y = intent.y;

        const prev_spawns = analysis.spawns[client_id]?.previous_spawns || [];

        // Store the spawn location
        analysis.spawns[client_id] = {
            x,
            y,
            turn: turn.turnNumber,
            previous_spawns: prev_spawns,
        };
    }
}

// ===== Game-update helpers =====
const is_game_update = (
    update: GameUpdateViewData | ErrorUpdate,
): update is GameUpdateViewData => {
    if ((update as GameUpdateViewData).tick) {
        return true;
    }
    return false;
};

/// Function to handle game updates. Returns true if the game is finished.
async function handle_game_update(
    gu: GameUpdateViewData | ErrorUpdate,
    pool: Pool,
    record: GameRecord,
    extraData: ExtraData,
): Promise<boolean> {
    const gameId = record.info.gameID;
    let gameIsWon = false;

    if (!is_game_update(gu)) {
        console.error("Error Update: ", gu);
        return false;
    }

    const shouldLogTick = gu.tick % 100 === 0;
    if (shouldLogTick) {
        console.log(`Game Update at tick`, gu.tick);
    }

    for (const [key, enumValue] of Object.entries(GameUpdateType)) {
        const ups: GameUpdate[] = gu.updates[enumValue] || [];
        const hasNoUpdates = ups.length === 0;

        if (hasNoUpdates) {
            continue;
        }

        // Add type information to updates
        ups.forEach((up) => {
            (up as any).type = key;
        });

        switch (enumValue) {
            case GameUpdateType.Unit:
                // Filter out trade ships and skip processing for now
                const filteredUps = ups.filter(
                    (u: UnitUpdate) => u.unitType !== UnitType.TradeShip,
                );
                continue; // TODO

            case GameUpdateType.Hash:
                continue;

            case GameUpdateType.DisplayEvent:
                await processDisplayEvents(ups, gameId, gu.tick, pool);
                break;

            case GameUpdateType.Player:
                await processPlayerUpdates(
                    ups,
                    gameId,
                    gu.tick,
                    pool,
                    extraData,
                );
                break;

            case GameUpdateType.Win:
                gameIsWon = true;
                break;

            default:
                await processGeneralEvents(ups, gameId, gu.tick, pool, key);
                break;
        }
    }

    return gameIsWon;
}

// Helper functions

async function processDisplayEvents(
    ups: GameUpdate[],
    gameId: string,
    tick: number,
    pool: Pool,
) {
    for (const up of ups) {
        const displayUpdate = up as DisplayMessageUpdate;
        const messageType = MessageType[displayUpdate.messageType];
        (up as any).messageType = messageType;

        const d = await pool.query(INSERT_DISPLAY_EVENT, [
            gameId,
            tick,
            displayUpdate.messageType,
            displayUpdate.message,
            displayUpdate.playerID,
            displayUpdate.goldAmount,
        ]);

        if (d?.rows[0].tick !== tick) {
            throw new Error(
                `Failed to insert display event for game ${gameId} at tick ${tick}`,
            );
        }
    }
}

async function processPlayerUpdates(
    ups: GameUpdate[],
    gameId: string,
    tick: number,
    pool: Pool,
    extraData: ExtraData,
) {
    if (tick % 10 !== 0) {
        return;
    }

    for (const up of ups) {
        const update = up as PlayerUpdate;
        const isAliveBit = update.isAlive ? 1 : 0;
        const isConnectedBit = !update.isDisconnected ? 1 : 0;
        const playerStatus = isAliveBit | (isConnectedBit << 1);

        const disconnectedAt =
            extraData.players_disconnected_on_turn[update.id];
        const playerIsLongDisconnected =
            disconnectedAt && disconnectedAt + 15 < tick;
        const shouldTrackDisconnection =
            tick > 301 && update.isDisconnected && !disconnectedAt;
        const shouldIgnoreBot =
            tick > 15 && update.playerType === PlayerType.Bot;

        if (playerIsLongDisconnected) {
            continue;
        }

        if (shouldTrackDisconnection) {
            extraData.players_disconnected_on_turn[update.id] = tick;
        }

        if (tick === 300) {
            await pool.query(INSERT_PLAYER, [
                gameId,
                update.id,
                update.clientID,
                update.smallID,
                update.playerType,
                update.name,
                null,
                typeof update.team === "string" ? null : update.team,
            ]);
        }

        if (shouldIgnoreBot) {
            continue;
        }

        const d = await pool.query(INSERT_PLAYER_UPDATE_NEW, [
            gameId,
            update.smallID,
            tick,
            isAliveBit,
            isConnectedBit,
            compress_value_for_db(update.tilesOwned),
            compress_value_for_db(update.gold),
            compress_value_for_db(update.workers),
            compress_value_for_db(update.troops),
        ]);

        let last_troop_ratio = extraData.players_troop_ratio?.[update.id];
        if(update.targetTroopRatio !== last_troop_ratio && update.playerType === PlayerType.Human) {
            await pool.query(INSERT_PLAYER_TROOP_RATIO_CHANGE, [
                gameId,
                update.smallID,
                update.clientID,
                update.targetTroopRatio,
            ]);
            extraData.players_troop_ratio[update.id] = update.targetTroopRatio;
        }

        if (d?.rows[0].tick !== tick) {
            throw new Error(
                `Failed to insert player update for game ${gameId} at tick ${tick}`,
            );
        }
    }
}

async function processGeneralEvents(
    ups: GameUpdate[],
    gameId: string,
    tick: number,
    pool: Pool,
    key: string,
) {
    for (const up of ups) {
        delete (up as any).type;

        try {
            const d = await pool.query(INSERT_GENERAL_EVENT, [
                gameId,
                tick,
                key,
                change_big_int_to_string_recursively(up),
            ]);

            if (d?.rows[0].tick !== tick) {
                throw new Error(`No rows from DB updated`);
            }
        } catch (e) {
            console.error(
                `Error inserting general event for game ${gameId} at tick ${tick}:`,
                e,
            );
        }
    }
}

function change_big_int_to_string_recursively(obj: any): any {
    if (typeof obj === "bigint") {
        return String(obj);
    }
    if (typeof obj !== "object" || obj === null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(change_big_int_to_string_recursively);
    }
    const newObj: any = {};
    for (const [k, v] of Object.entries(obj)) {
        newObj[k] = change_big_int_to_string_recursively(v);
    }
    return newObj;
}

// ===== Main entry point =====
export const base_log = new Logger();

async function processPendingGames(pool: Pool): Promise<void> {
    // Select 1 job from DB by updating a single row from the analysis_queue table (INNER JOIN with finished_games)
    // We set the analysis_status to 'Running' and then select the game_id and result_json
    const res = await pool.query(SELECT_AND_UPDATE_JOB);

    for (const game of res.rows) {
        console.log("Game ID: ", game.game_id);
        const r = game.result_json as GameRecord;
        const record = decompressGameRecord(r);

        let new_state = "Completed";
        const time_now = Date.now();
        try {
            const analysis = await simgame(game.game_id, record, pool);
        } catch (e) {
            console.log("The analysis failed for game", game.game_id, e);
            new_state = "Failed";
        } finally {
            const time_taken = Date.now() - time_now;

            console.log(
                `Analysis for game ${game.game_id} = ${new_state} in ${time_taken} ms. Game winner:`,
                record.info.winner,
            );
        }

        // Update analysis_queue table with the game_id and status 'Completed'
        await pool.query(UPDATE_ANALYSIS_QUEUE_STATUS, [
            game.game_id,
            new_state,
        ]);
    }
}

async function setup(): Promise<Pool> {
    const dbUrl = new URL(DATABASE_URL!);
    const poolConfig = {
        host: dbUrl.hostname,
        port: Number(dbUrl.port) || 5432,
        user: dbUrl.username,
        password: dbUrl.password,
        database: dbUrl.pathname.replace(/^\//, ""),
    };

    const p = new Pool(poolConfig);

    await p.connect();

    console.log("Connected to database");

    return p;
}

async function main(database: Pool): Promise<void> {
    try {

        for (;;) {
            await processPendingGames(database);
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    } catch (e) {
        console.error("Error: ", e);
    }
}

let db = setup();
db.then(database => main(database));
