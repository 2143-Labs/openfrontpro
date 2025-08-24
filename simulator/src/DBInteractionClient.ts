import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { parse } from "node:url";
import { once } from "node:events";

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
import { change_big_int_to_string_recursively, finalize_and_insert_analysis, load_map_data, setup } from "./Util";
import { cleanup_previous_analysis, INSERT_DISPLAY_EVENT, INSERT_GENERAL_EVENT, INSERT_PLAYER, INSERT_PLAYER_TROOP_RATIO_CHANGE, INSERT_PLAYER_UPDATE_NEW, INSERT_SPAWN_LOCATIONS, SELECT_AND_UPDATE_JOB, UPDATE_ANALYSIS_QUEUE_STATUS, UPSERT_COMPLETED_ANALYSIS } from "./Sql";
import { simgame } from "./SimGame";
import { current_processing_game } from "./ListGames";

// ===== Main entry point =====
// export const base_log = new Logger();
// 
// 
// 
// // Route 1: GET /retreive_game
// async function get_retreive_game(req: IncomingMessage, res: ServerResponse, pool: Pool): Promise<void> {
//     try {
//         const queryResult = await pool.query(SELECT_AND_UPDATE_JOB);
// 
//         if (queryResult.rowCount === 0 || !queryResult || !queryResult.rows[0]) {
//             console.log("No pending games found.");
//             res.writeHead(200, { 'Content-Type': 'application/json' });
//             res.end(JSON.stringify({ message: "No pending games" }));
//             return;
//         }
// 
//         if (queryResult.rowCount > 1) {
//             console.warn("More than one pending game found, processing only the first one.");
//         }
// 
//         const game = queryResult.rows[0];
//         console.log("Processing Game ID:", game.game_id);
// 
//         let new_state = "Completed";
//         const time_now = Date.now();
//         try {
//             const r = game.result_json as GameRecord;
//             const record = decompressGameRecord(r);
//             await cleanup_previous_analysis(pool, game.game_id);
//             const analysis = await simgame(game.game_id, record);
//             await finalize_and_insert_analysis(pool, analysis);
// 
//             console.log(
//                 `Analysis for game ${game.game_id} = ${new_state} in ${Date.now() - time_now} ms.`,
//             );
// 
//             // Send successful response with game data
//             res.writeHead(200, { 'Content-Type': 'application/json' });
//             res.end(JSON.stringify({
//                 game_id: game.game_id,
//                 result_json: game.result_json
//             }));
// 
//         } catch (e) {
//             console.log("The analysis failed for game", game.game_id, e);
//             new_state = "Failed";
// 
//             // Reset job state to Failed and send error response
//             await pool.query(UPDATE_ANALYSIS_QUEUE_STATUS, [
//                 game.game_id,
//                 new_state,
//             ]);
// 
//             res.writeHead(500, { 'Content-Type': 'application/json' });
//             res.end(JSON.stringify({ 
//                 error: `Analysis failed for game ${game.game_id}: ${e instanceof Error ? e.message : String(e)}` 
//             }));
//             return;
//         }
// 
//         // Update analysis_queue table with the game_id and status 'Completed'
//         await pool.query(UPDATE_ANALYSIS_QUEUE_STATUS, [
//             game.game_id,
//             new_state,
//         ]);
//     } catch (dbError) {
//         console.error("Database error in retreive_game:", dbError);
//         res.writeHead(500, { 'Content-Type': 'application/json' });
//         res.end(JSON.stringify({
//             error: `Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}` 
//         }));
//     }
// }
// 
// // Route 2: POST /submit_game
// async function post_submit_game(req: IncomingMessage, res: ServerResponse, pool: Pool): Promise<{ status: string, game_id: string }> {
//     // Get analysis from request body
//     let analysis: Analysis = JSON.parse(req.read());
//     let new_state = "Completed";
//     let fut: Promise<any>;
//     try {
//         fut = finalize_and_insert_analysis(pool, analysis);
//     } catch (error) {
//         fut = Promise.resolve(null);
//         console.error("Error finalizing and inserting analysis:", error);
//         new_state = "Failed";
//     }
// 
//     // Send a character every 10 seconds to keep the connection alive
//     const interval = setInterval(() => {
//         console.log("Keeping connection alive...");
//         res.write(" "); // Send a space character to keep the connection alive
//     }, 10000);
// 
//     await fut; // Wait for the analysis to be finalized and inserted
// 
//     // When `fut` resolves
//     // 1. update the analysis queue status (below)
//     // 2. send the response back to the client
//     await pool.query(UPDATE_ANALYSIS_QUEUE_STATUS, [
//         analysis.game_id,
//         new_state,
//     ]);
//     clearInterval(interval);
// 
//     return { status: new_state, game_id: analysis.game_id };
// }
// 
// 
// // Route 3: GET /health
// async function health(): Promise<{ status: string }> {
//     // This function should return a simple health check response
//     return { status: "ok" };
// }
// 
// export async function db_interaction_server(database: Pool): Promise<void> {
//     const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
//         const parsedUrl = parse(req.url || '', true);
//         const method = req.method;
//         const pathname = parsedUrl.pathname;
// 
//         console.log(`${method} ${pathname}`);
// 
//         // Handle CORS headers
//         res.setHeader('Access-Control-Allow-Origin', '*');
//         res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
//         res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
// 
//         if (method === 'OPTIONS') {
//             res.writeHead(200);
//             res.end();
//             return;
//         }
// 
//         try {
//             if (method === 'GET' && pathname === '/retreive_game') {
//                 await get_retreive_game(req, res, database);
//             } else if (method === 'GET' && pathname === '/health') {
//                 const healthResponse = await health();
//                 res.writeHead(200, { 'Content-Type': 'application/json' });
//                 res.end(JSON.stringify(healthResponse));
//             } else if (method === 'POST' && pathname === '/submit_game') {
//                 let jResponse = await post_submit_game(req, res, database);
//                 res.writeHead(200, { 'Content-Type': 'application/json' });
//                 res.end(JSON.stringify(jResponse));
//             } else {
//                 res.writeHead(404, { 'Content-Type': 'application/json' });
//                 res.end(JSON.stringify({ error: 'Route not found' }));
//             }
//         } catch (error) {
//             console.error('Unhandled error in request handler:', error);
//             res.writeHead(500, { 'Content-Type': 'application/json' });
//             res.end(JSON.stringify({ 
//                 error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` 
//             }));
//         }
//     });
// 
//     const PORT = process.env.PORT || 3000;
//     server.listen(PORT, () => {
//         console.log(`DB Interaction Server running on port ${PORT}`);
//         console.log(`Available routes:`);
//         console.log(`  GET /retreive_game - retreive and process a pending game`);
//         console.log(`  POST /submit_game - submit game analysis data`);
//         console.log(`  GET /health - Health check`);
//     });
// }


/**
 * Client function that retrieves a game from the analysis endpoint, processes it,
 * and submits the analysis back to the server.
 *
 * @param analysis_endpoint - The base URL of the analysis server
 * @returns Promise<any | void> - Returns the parsed server response from the submit operation,
 *                                or void if no game was available or an error occurred.
 *                                Callers can use this response to act on the server's feedback.
 */
export async function db_sim_client(analysis_endpoint: string): Promise<any | void> {
    let game: any;
    let new_state = "Completed";
    const time_now = Date.now();

    try {
        // Get game from the {analysis_endpoint}/retreive_game endpoint
        try {
            const response = await fetch(`${analysis_endpoint}/retreive_game`);
            game = await response.json();
        } catch (networkError) {
            console.error("Network error retrieving game:", networkError);
            new_state = "Failed";
            throw networkError; // Re-throw so the outer finally section still logs duration with the correct state
        }

        // Check if server returned "No pending games" message
        if (game.message === "No pending games" || !game.game_id) {
            console.log("No pending games available from server");
            return; // Return void - no game to process
        }

        console.log("Game ID: ", game.game_id);

        const r = game.result_json as GameRecord;
        const record = decompressGameRecord(r);
        const analysis = await simgame(game.game_id, record);
        const body = JSON.stringify(change_big_int_to_string_recursively(analysis));
        let body_size = body.length;
        console.log(`Prepared analysis for game ${game.game_id} with body size: ${body_size} bytes`);
        fs.writeFile(`./analysis_${game.game_id}.json`, body)
        // send game data to {analysis_endpoint}/submit_game
        try {
            const submitResponse = await fetch(`${analysis_endpoint}/submit_game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: body
            });

            // Step 4: Handle response and update new_state
            if (submitResponse.ok) {
                const serverResp = await submitResponse.json();
                console.log('Submit response:', serverResp);
                // Return the server response for callers to act on
                return serverResp;
            } else {
                const errorText = await submitResponse.text();
                console.error(`Failed to submit game data: ${submitResponse.status} ${submitResponse.statusText}`);
                console.error('Error response body:', errorText);
                new_state = "Failed";
                throw new Error(`Submit failed with status ${submitResponse.status}: ${errorText}`);
            }
        } catch (networkError) {
            console.error(`Network error submitting game ${game.game_id}:`, networkError);
            new_state = "Failed";
            throw networkError; // Re-throw to ensure the outer catch records failure time
        }
    } catch (e) {
        console.log("The analysis failed for game", game?.game_id || "unknown", e);
        new_state = "Failed";
    } finally {
        const time_taken = Date.now() - time_now;

        console.log(
            `Analysis for game ${game?.game_id || "unknown"} = ${new_state} in ${time_taken} ms.`,
        );
    }
}

export async function db_sim_single_game(game_id: string): Promise<void> {
    let game_info = await fetch(`https://api.openfront.io/game/${game_id}`);
    if (!game_info.ok) {
        throw new Error(`Failed to fetch game info for ${game_id}: ${game_info.status} ${game_info.statusText}`);
    }

    let r: GameRecord = await game_info.json();
    const record = decompressGameRecord(r);

    const analysis = await simgame(game_id, record);

}
