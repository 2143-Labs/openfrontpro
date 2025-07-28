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
import { cleanup_previous_analysis, INSERT_DISPLAY_EVENT, INSERT_GENERAL_EVENT, INSERT_PLAYER, INSERT_PLAYER_TROOP_RATIO_CHANGE, INSERT_PLAYER_UPDATE_NEW, INSERT_SPAWN_LOCATIONS, SELECT_AND_UPDATE_JOB, UPDATE_ANALYSIS_QUEUE_STATUS, UPSERT_COMPLETED_ANALYSIS } from "./Sql";
import { simgame } from "./SimGame";
import { db_interaction_server } from "./DBInteractionServer";
import { db_sim_client } from "./DBInteractionClient";


// ===== Main entry point =====
export const base_log = new Logger();
export let current_processing_game: string | null = null;
export let global_pool: Pool | null = null;

async function process_pending_games(pool: Pool): Promise<void> {
    // Select 1 job from DB by updating a single row from the analysis_queue table (INNER JOIN with finished_games)
    // We set the analysis_status to 'Running' and then select the game_id and result_json
    const res = await pool.query(SELECT_AND_UPDATE_JOB);

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

async function main(database: Pool): Promise<void> {
    global_pool = database;

    if(process.env.RUN_SERVER === "true") {
        await db_interaction_server(database);
        return;
    }
    for (;;) {
        try {
            await process_pending_games(database);
        } catch (e) {
            console.error("Error: ", e);
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }

}


if(process.env.RUN_CLIENT) {
    if(process.env.RUN_CLIENT === "true") {
        process.env.RUN_CLIENT = "http://analysis.openfront.pro";
    }
    console.log("Running as client with URL: ", process.env.RUN_CLIENT);
    await db_sim_client(process.env.RUN_CLIENT);
} else {
    let db = setup();
    db.then(database => main(database));
}

// Add ctrl c handler to reset our state back to pending
process.on("SIGTERM", endall);
process.on("SIGINT", endall);

function endall() {
    console.log("Ending all processes...");
    if (current_processing_game) {
        console.log("Current processing game: ", current_processing_game);
        // set db state back to pending
        global_pool?.query(UPDATE_ANALYSIS_QUEUE_STATUS, [
            current_processing_game,
            "Pending",
        ]).catch((e) => console.error("Failed to reset game state: ", e));
    } else {
        console.log("No current processing game.");
    }

    process.exit(0);
}
