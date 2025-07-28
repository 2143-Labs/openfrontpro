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
import { performance } from "perf_hooks";

import fs from "fs/promises";
import { Pool } from "pg";
import { on } from "events";

// ===== Constants / Types =====
let { DATABASE_URL, MAP_FOLDER } = process.env;
if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
}

if (!MAP_FOLDER) {
    MAP_FOLDER = "./OpenFrontIO/resources/maps";
}
let maps = [
    "africa",
    "asia",
    "australia",
    "baikal",
    "betweentwoseas",
    "blacksea",
    "britannia",
    "deglaciatedantarctica",
    "eastasia",
    "europe",
    "europeclassic",
    "falklandislands",
    "faroeislands",
    "gatewaytotheatlantic",
    "giantworldmap",
    "halkidiki",
    "iceland",
    "italia",
    "mars",
    "mena",
    "northamerica",
    "oceania",
    "pangaea",
    "southamerica",
    "straitofgibraltar",
    "world",
];


for(let map of maps) {
    const map_data = await load_map_data(
        MAP_FOLDER!,
        map,
    );
    console.log(`Map ${map_data.manifest.name} = ${map_data.manifest.map.width}x${map_data.manifest.map.height}`);
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
    game_id: string;
    players: PlayerInfo[];
    spawns: Record<string, PlayerSpawn>;

    ins_troop_ratio: any[][];
    ins_general_event: any[][];
    ins_display_event: any[][];
    ins_player: any[][];
    ins_player_update: any[][];
};

type ExtraData = {
    players_died_on_turn: Record<string, number>;
    players_disconnected_on_turn: Record<string, number>;
    players_troop_ratio: Record<string, number>;
    last_tick_update_time: number;
};

// ===== Database helpers =====

const INSERT_SPAWN_LOCATIONS = format_sql`
  INSERT INTO analysis_1.spawn_locations (game_id, client_id, tick, x, y, previous_spawns)
  VALUES ($1, $2, $3, $4, $5, $6)
`;

const UPSERT_COMPLETED_ANALYSIS = format_sql`
  INSERT INTO analysis_1.completed_analysis (game_id, analysis_engine_version)
  VALUES ($1, $2)
  ON CONFLICT (game_id) DO UPDATE
  SET inserted_at_unix_sec = EXTRACT(EPOCH FROM NOW()),
      analysis_engine_version = $2
`;

const INSERT_DISPLAY_EVENT = format_sql`
  INSERT INTO
    analysis_1.display_events (game_id, tick, message_type, message, player_id, gold_amount)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING tick
`;

const INSERT_PLAYER = format_sql`
  INSERT INTO
    analysis_1.players (
      game_id, id, client_id, small_id, player_type, name, flag, team
    )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

const INSERT_GENERAL_EVENT = format_sql`
  INSERT INTO
    analysis_1.general_events (game_id, tick, event_type, data)
  VALUES ($1, $2, $3, $4)
  RETURNING tick
`;

const SELECT_AND_UPDATE_JOB = format_sql`
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

const UPDATE_ANALYSIS_QUEUE_STATUS = format_sql`
  UPDATE analysis_queue
  SET
    status = $2
  WHERE game_id = $1
`;

const INSERT_PLAYER_UPDATE_NEW = format_sql`
  INSERT INTO
    analysis_1.packed_player_updates (game_id, small_id, tick, player_alive, player_connected, tiles_owned, gold, workers, troops)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING tick
`;

const INSERT_PLAYER_TROOP_RATIO_CHANGE = format_sql`
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

//pub fn decompress_value_from_db(value: i16) -> u64 {
    //let encoded = ((value as i32) + 32768) as u16;
    //let max_input_log = (1_000_000_000_000u64 as f64 + 1.0).log10();
    //let norm = encoded as f64 / 65535.0;

    //(10f64.powf(norm * max_input_log) - 1.0).round() as u64
//}

function decompress_value_from_db(value: number): bigint {
    const encoded = (value + 32768) & 0xFFFF; // Ensure it's within u16 range
    const max_input_log = Math.log10(1_000_000_000_000 + 1);
    const norm = encoded / 65535;
    return BigInt(Math.round(Math.pow(10, norm * max_input_log) - 1));
}

function turn_u16_to_i16(value: number): number {
    return value - 32768;
}

function compress_value_for_db(value: number | bigint): number {
    return turn_u16_to_i16(encode_float_to_u16(value));
}

for (let v of [0, 1, 10, 100, 1000, 100_000, 5_000_000, 1_000_000_000]) {
    let compressed = compress_value_for_db(v);
    let decompressed = decompress_value_from_db(compressed);
    let error = Math.abs(Number(decompressed) - Number(v));
    let error_percent = (error / Number(v)) * 100;
    console.log(`Value: ${v}, Encoded: ${encode_float_to_u16(v)}, Compressed: ${compressed}, Decompressed: ${decompressed}, Error: ${error_percent.toFixed(2)}%`);
}

// ===== Database cleanup helpers =====
async function cleanup_previous_analysis(
    pool: Pool,
    gameId: string,
): Promise<void> {
    const tableNames = [
        "general_events",
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
//function game_type_from_name(name: string): GameMapType {
    //for (const [k, v] of Object.entries(GameMapType)) {
        //if (v === name) {
            //return k as GameMapType;
        //}
    //}
    //throw new Error(`Unknown game type: ${name}`);
//}

async function load_map_data(
    maps_path: string,
    map_name: string,
): Promise<MapData> {
    //let map_type = game_type_from_name(map_name);
    const map_file_name = map_name.replace(/ /g, "").toLowerCase();

    const map_file = fs.readFile(`${maps_path}/${map_file_name}/map.bin`);
    console.log(`Loading map file: ${map_file}`);
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

// ===== Analysis =====
async function runSimulation(runner: GameRunner, record: GameRecord, analysis: Analysis, extraData: ExtraData, mapImpl: GameMapImpl) {
    runner.init();
    let simulation_turns_left = -1;
    for (const turn of record.turns) {
        await analyze_intents(turn, record, analysis, extraData, mapImpl);
        runner.addTurn(turn);
        runner.executeNextTick();
        //await new Promise((resolve) => setTimeout(resolve, 10));
        if (simulation_turns_left === 0) {
            console.log("Player has won, stopping simulation.");
            return;
        } else if (simulation_turns_left > 0) {
            console.log("Simulation turns left: ", simulation_turns_left);
            simulation_turns_left--;
        }
    }
}

/// Insert all the data into the database
async function finalize_and_insert_analysis(
    pool: Pool,
    analysis: Analysis,
): Promise<Analysis> {
    const gameId = analysis.game_id;

    let start_time = performance.now();

    console.log("Inserting analysis for game", gameId);
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

    for (const display_event of analysis.ins_display_event) {
        await pool.query(INSERT_DISPLAY_EVENT, display_event);
    }

    for (const player of analysis.ins_player) {
        await pool.query(INSERT_PLAYER, player);
    }

    for (const general_event of analysis.ins_general_event) {
        await pool.query(INSERT_GENERAL_EVENT, general_event);
    }

    for (const player_update of analysis.ins_player_update) {
        await pool.query(INSERT_PLAYER_UPDATE_NEW, player_update);
    }

    for (const troop_ratio of analysis.ins_troop_ratio) {
        await pool.query(INSERT_PLAYER_TROOP_RATIO_CHANGE, troop_ratio);
    }

    await pool.query(UPSERT_COMPLETED_ANALYSIS, [gameId, "v1"]);

    let time_taken = performance.now() - start_time;
    console.log(`Inserted analysis for game ${gameId} in ${(time_taken / 1000).toFixed(1)}s.`);
    return analysis;
}

// ===== Simulation helpers =====
async function simgame(gameId: string, record: GameRecord): Promise<Analysis> {
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
    let extra_data: ExtraData = {
        players_died_on_turn: {},
        players_disconnected_on_turn: {},
        players_troop_ratio: {},
        last_tick_update_time: performance.now(),
    };

    // This is the actual result of the analysis
    let analysis: Analysis = {
        game_id: gameId,
        players: humans,
        spawns: {},
        ins_troop_ratio: [],
        ins_general_event: [],
        ins_display_event: [],
        ins_player: [],
        ins_player_update: [],
    };


    // -1 means unlimited. Game ends at 0;
    let simulation_turns_left = -1;
    const runner = new GameRunner(
        game,
        new Executor(game, gameId, "openfrontpro"),
        async (gu) => {
            const has_won = await handle_game_update(gu, record, extra_data, analysis);
            if (simulation_turns_left === -1 && has_won) {
                simulation_turns_left = 5;
            }
        },
    );

    game

    // Run the simulation: this modifies the analysis and extra_data objects
    await runSimulation(runner, record, analysis, extra_data, map_impl);
    console.log("Simulation complete. Finalizing analysis.");

    return analysis;
}

async function analyze_intents(
    turn: Turn,
    _record: GameRecord,
    analysis: Analysis,
    extra_data: ExtraData,
    map_impl: GameMapImpl,
): Promise<void> {
    for (const intent of turn.intents) {
        if (intent.type !== "spawn") {
            continue;
        }

        const client_id = intent.clientID;
        let tile = intent.tile;
        const x = map_impl.x(tile)
        const y = map_impl.y(tile);

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
    record: GameRecord,
    extra_data: ExtraData,
    analysis: Analysis,
): Promise<boolean> {
    const game_id = record.info.gameID;
    let game_is_won = false;

    if (!is_game_update(gu)) {
        console.error("Error Update: ", gu);
        return false;
    }

    for (const [key, enum_value] of Object.entries(GameUpdateType)) {
        const ups: GameUpdate[] = gu.updates[enum_value] || [];
        if (ups.length === 0) {
            continue;
        }

        // Add type information to updates
        ups.forEach((up) => {
            (up as any).type = key;
        });

        switch (enum_value) {
            case GameUpdateType.Unit:
                // Filter out trade ships and skip processing for now
                const filteredUps = ups.filter(
                    (u: UnitUpdate) => u.unitType !== UnitType.TradeShip,
                );
                continue; // TODO

            case GameUpdateType.Hash:
                continue;

            case GameUpdateType.DisplayEvent:
                await process_display_events(ups, game_id, gu.tick, analysis);
                break;

            case GameUpdateType.Player:
                await process_player_updates(
                    ups,
                    game_id,
                    gu.tick,
                    extra_data,
                    analysis,
                );
                break;

            case GameUpdateType.Win:
                game_is_won = true;
                // fall through

            default:
                await process_general_events(ups, game_id, gu.tick, analysis, key);
                break;
        }
    }

    const num_print_ticks = 300;
    const should_log_tick = gu.tick % num_print_ticks === (num_print_ticks - 1);
    if (should_log_tick) {
        let tick_time_ms = performance.now() - (extra_data.last_tick_update_time || 0);
        let ticks_per_sec = (num_print_ticks * 1000 / tick_time_ms).toFixed(2);
        console.log(`Game Update: ${gu.tick + 1} ticks. ${ticks_per_sec}t/s.`);
        extra_data.last_tick_update_time = performance.now();
    }

    return game_is_won;
}

// Helper functions
async function process_display_events(
    ups: GameUpdate[],
    game_id: string,
    tick: number,
    analysis: Analysis,
) {
    for (const up of ups) {
        const displayUpdate = up as DisplayMessageUpdate;
        const messageType = MessageType[displayUpdate.messageType];
        (up as any).messageType = messageType;

        analysis.ins_display_event.push([
            game_id,
            tick,
            displayUpdate.messageType,
            displayUpdate.message,
            displayUpdate.playerID,
            displayUpdate.goldAmount,
        ]);
    }
}

async function process_player_updates(
    ups: GameUpdate[],
    game_id: string,
    tick: number,
    extra_data: ExtraData,
    analysis: Analysis,
) {
    if (tick % 10 !== 0) {
        return;
    }

    for (const up of ups) {
        const update = up as PlayerUpdate;
        const is_alive_bit = update.isAlive ? 1 : 0;
        const is_connected_bit = !update.isDisconnected ? 1 : 0;

        const disconnected_at =
            extra_data.players_disconnected_on_turn[update.id];
        const player_is_disconnected_long =
            disconnected_at && disconnected_at + 15 < tick;
        const should_look_for_disconnects =
            tick > 301 && update.isDisconnected && !disconnected_at;
        const should_ignore_this_bot =
            tick > 15 && update.playerType === PlayerType.Bot;

        if (should_look_for_disconnects) {
            extra_data.players_disconnected_on_turn[update.id] = tick;
        }

        if (tick === 300) {
            analysis.ins_player.push([
                game_id,
                update.id,
                update.clientID,
                update.smallID,
                update.playerType,
                update.name,
                null,
                typeof update.team === "string" ? null : update.team,
            ]);
        }

        if (player_is_disconnected_long) {
            continue;
        }

        if (should_ignore_this_bot) {
            continue;
        }

        if(update.tilesOwned == 0 && update.gold == 0n && !update.clientID) {
            continue; // Ignore Nations that have no tiles and no gold
        }

        analysis.ins_player_update.push([
            game_id,
            update.smallID,
            tick,
            is_alive_bit,
            is_connected_bit,
            compress_value_for_db(update.tilesOwned),
            compress_value_for_db(update.gold),
            compress_value_for_db(update.workers),
            compress_value_for_db(update.troops),
        ]);

        let last_troop_ratio = extra_data.players_troop_ratio?.[update.id];
        if(update.targetTroopRatio !== last_troop_ratio && update.playerType === PlayerType.Human) {
            analysis.ins_troop_ratio.push([
                game_id,
                update.smallID,
                update.clientID,
                update.targetTroopRatio,
            ]);
            extra_data.players_troop_ratio[update.id] = update.targetTroopRatio;
        }
    }
}

async function process_general_events(
    ups: GameUpdate[],
    game_id: string,
    tick: number,
    analysis: Analysis,
    key: string,
) {
    for (const up of ups) {
        delete (up as any).type;

        analysis.ins_general_event.push([
            game_id,
            tick,
            key,
            change_big_int_to_string_recursively(up),
        ]);
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

async function process_pending_games(pool: Pool): Promise<void> {
    // Select 1 job from DB by updating a single row from the analysis_queue table (INNER JOIN with finished_games)
    // We set the analysis_status to 'Running' and then select the game_id and result_json
    const res = await pool.query(SELECT_AND_UPDATE_JOB);

    for (const game of res.rows) {
        console.log("Game ID: ", game.game_id);

        let new_state = "Completed";
        const time_now = Date.now();
        try {
            const r = game.result_json as GameRecord;
            const record = decompressGameRecord(r);
            await cleanup_previous_analysis(pool, game.game_id);
            const analysis = await simgame(game.game_id, record);
            await finalize_and_insert_analysis(pool, analysis);
        } catch (e) {
            console.log("The analysis failed for game", game.game_id, e);
            new_state = "Failed";
        } finally {
            const time_taken = Date.now() - time_now;

            console.log(
                `Analysis for game ${game.game_id} = ${new_state} in ${time_taken} ms.`,
            );
        }

        // Update analysis_queue table with the game_id and status 'Completed'
        await pool.query(UPDATE_ANALYSIS_QUEUE_STATUS, [
            game.game_id,
            new_state,
        ]);
    }
}

function format_sql(strings: TemplateStringsArray, ...values: any[]): string {
    return strings.reduce(
        (acc, str, index) => acc + str + (values[index] || ""),
        "",
    );
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
    for (;;) {
        try {
            await process_pending_games(database);
        } catch (e) {
            console.error("Error: ", e);
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }

}

let db = setup();
db.then(database => main(database));
