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

import { DATABASE_URL, MapData, Analysis } from "./Types";
import { INSERT_SPAWN_LOCATIONS, INSERT_DISPLAY_EVENT, INSERT_PLAYER, INSERT_GENERAL_EVENT, INSERT_PLAYER_UPDATE_NEW, INSERT_PLAYER_TROOP_RATIO_CHANGE, UPSERT_COMPLETED_ANALYSIS, INSERT_PLAYER_UPDATE_NEW_PACKED } from "./Sql";

export async function load_map_data(
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

export async function setup(): Promise<Pool> {
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

// ===== Database helpers =====

// Maps a value from the range [0, 1T] to a range of small int: -32768 to 32767
export function encode_float_to_u16(value: number | bigint): number {
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

export function decompress_value_from_db(value: number): bigint {
    const encoded = (value + 32768) & 0xFFFF; // Ensure it's within u16 range
    const max_input_log = Math.log10(1_000_000_000_000 + 1);
    const norm = encoded / 65535;
    return BigInt(Math.round(Math.pow(10, norm * max_input_log) - 1));
}

export function turn_u16_to_i16(value: number): number {
    return value - 32768;
}

export function compress_value_for_db(value: number | bigint): number {
    return turn_u16_to_i16(encode_float_to_u16(value));
}


/// Insert all the data into the database
export async function finalize_and_insert_analysis(
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

    let time_taken = performance.now() - start_time;
    start_time = performance.now();
    console.log(`Finished inserting spawn locations for game ${gameId} in ${(time_taken / 1000).toFixed(1)}s.`);
    for (const display_event of analysis.ins_display_event) {
        await pool.query(INSERT_DISPLAY_EVENT, display_event);
    }

    time_taken = performance.now() - start_time;
    start_time = performance.now();
    console.log(`Finished inserting display events for game ${gameId} in ${(time_taken / 1000).toFixed(1)}s.`);
    for (const player of analysis.ins_player) {
        await pool.query(INSERT_PLAYER, player);
    }

    time_taken = performance.now() - start_time;
    start_time = performance.now();
    console.log(`Finished inserting players for game ${gameId} in ${(time_taken / 1000).toFixed(1)}s.`);
    for (const general_event of analysis.ins_general_event) {
        await pool.query(INSERT_GENERAL_EVENT, general_event);
    }

    time_taken = performance.now() - start_time;
    start_time = performance.now();
    console.log(`Finished inserting general events for game ${gameId} in ${(time_taken / 1000).toFixed(1)}s.`);
    console.log("ok starting")
    //let stuff: any[][] = [];
    //for (const player_update of analysis.ins_player_update) {
        //if (!stuff[0] || stuff[0].length < 9) {
            //for(let stuff_i in player_update) {
                //stuff[stuff_i] = stuff[stuff_i] || [];
                //stuff[stuff_i].push(player_update[stuff_i]);
            //}
            //continue;
        //}
        ////if(stuff.length < 10) {
            ////stuff.push(player_update);
            ////continue;
        ////}

        //console.log("insertihng", stuff);
        //let res = await pool.query(INSERT_PLAYER_UPDATE_NEW_PACKED, stuff);
        //if(res.rowCount !== stuff.length) {
            //console.error(`Error inserting player updates for game ${gameId}: expected ${stuff.length} rows, got ${res.rowCount}`);
        //}
        //stuff = [];
    //}
    //let res = await pool.query(INSERT_PLAYER_UPDATE_NEW_PACKED, stuff);
    //if(res.rowCount !== stuff.length) {
        //console.error(`Error inserting player updates for game ${gameId}: expected ${stuff.length} rows, got ${res.rowCount}`);
    //}
    console.log(`Inserting ${analysis.ins_player_update.length} player updates for game ${gameId}...`);
    for (const player_update of analysis.ins_player_update) {
        const res = await pool.query(INSERT_PLAYER_UPDATE_NEW, player_update);
    }


    time_taken = performance.now() - start_time;
    start_time = performance.now();
    console.log(`Finished inserting player updates for game ${gameId} in ${(time_taken / 1000).toFixed(1)}s.`);
    for (const troop_ratio of analysis.ins_troop_ratio) {
        await pool.query(INSERT_PLAYER_TROOP_RATIO_CHANGE, troop_ratio);
    }

    await pool.query(UPSERT_COMPLETED_ANALYSIS, [gameId, "v1"]);

    time_taken = performance.now() - start_time;
    console.log(`Inserted analysis for game ${gameId} in ${(time_taken / 1000).toFixed(1)}s.`);
    return analysis;
}

export function change_big_int_to_string_recursively(obj: any): any {
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
