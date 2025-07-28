
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
import { Analysis, DATABASE_URL, ExtraData } from "./Types";
import { finalize_and_insert_analysis, load_map_data, setup } from "./Util";
import { INSERT_DISPLAY_EVENT, INSERT_GENERAL_EVENT, INSERT_PLAYER, INSERT_PLAYER_TROOP_RATIO_CHANGE, INSERT_PLAYER_UPDATE_NEW, INSERT_SPAWN_LOCATIONS, SELECT_AND_UPDATE_JOB, UPDATE_ANALYSIS_QUEUE_STATUS, UPSERT_COMPLETED_ANALYSIS } from "./Sql";

// ===== Main entry point =====
export const base_log = new Logger();



// Route 1: GET /retreive_game
async function get_retreive_game(..., pool: Pool, ...): ... {
    const res = await pool.query(SELECT_AND_UPDATE_JOB);

    if (res.rowCount === 0 || !res.rows[0]) {
        console.log("No pending games found.");
        return;
    }

    if (res.rowCount > 1) {
        console.warn("More than one pending game found, processing only the first one.");
    }

    // Send json respnose: {
    //     game_id: res.rows[0].game_id,
    //     result_json: res.rows[0].result_json,
    // }

    for (const game of res.rows) {
        console.log("Game ID: ", game.game_id);

        let new_state = "Completed";
        const time_now = Date.now();
        try {
            current_processing_game = game.game_id;
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

// Route 2: POST /submit_game
async function get_retreive_game(..., pool: Pool, ...): ... {
    let analysis: Analysis = ...; // Get analysis from request body
    let new_state = "Completed";
    let fut;
    try {
        fut = finalize_and_insert_analysis(pool, analysis);
    } catch (error) {
        console.error("Error finalizing and inserting analysis:", error);
        new_state = "Failed";
    }

    // Send a character every 10 seconds to keep the connection alive
    const interval = setInterval(() => {
        console.log("Keeping connection alive...");
        // TODO: Send a " " character or similar to keep the connection alive but not affect the json response
    }, 10000);

    await fut; // Wait for the analysis to be finalized and inserted

    // TODO: When `fut` resolves
    // 1. update the analysis queue status (below)
    // 2. send the response back to the client
    await pool.query(UPDATE_ANALYSIS_QUEUE_STATUS, [
        analysis.game_id,
        new_state,
    ]);
    clearInterval(interval);

    return { status: new_state, game_id: analysis.game_id };
}


// Route 3: GET /health
async function health(): Promise<{ status: string }> {
    // This function should return a simple health check response
    return { status: "ok" };
}

async function main(database: Pool): Promise<void> {
    // Setup a server here to listen to the routes (

}

let db = setup();
db.then(database => main(database));

// Add ctrl c handler to reset our state back to pending
process.on("SIGTERM", endall);
process.on("SIGINT", endall);


