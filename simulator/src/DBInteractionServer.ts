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
import { finalize_and_insert_analysis, load_map_data, setup } from "./Util";
import { cleanup_previous_analysis, INSERT_DISPLAY_EVENT, INSERT_GENERAL_EVENT, INSERT_PLAYER, INSERT_PLAYER_TROOP_RATIO_CHANGE, INSERT_PLAYER_UPDATE_NEW, INSERT_SPAWN_LOCATIONS, SELECT_AND_UPDATE_JOB, UPDATE_ANALYSIS_QUEUE_STATUS, UPSERT_COMPLETED_ANALYSIS } from "./Sql";
import { simgame } from "./SimGame";
import { current_processing_game, endall } from "./ListGames";

// ===== Main entry point =====
export const base_log = new Logger();



// Route 1: GET /retreive_game
async function get_retreive_game(req: IncomingMessage, res: ServerResponse, pool: Pool): Promise<void> {
    try {
        const queryResult = await pool.query(SELECT_AND_UPDATE_JOB);

        if (queryResult.rowCount === 0 || !queryResult || !queryResult.rows[0]) {
            console.log("No pending games found.");
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: "No pending games" }));
            return;
        }

        if (queryResult.rowCount > 1) {
            console.warn("More than one pending game found, processing only the first one.");
        }

        const game = queryResult.rows[0];
        console.log("Someone is processing Game ID:", game.game_id);

        // Send successful response with game data
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            game_id: game.game_id,
            result_json: game.result_json
        }));
    } catch (dbError) {
        console.error("Database error in retreive_game:", dbError);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: `Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}` 
        }));
    }
}

// Route 2: POST /submit_game
async function post_submit_game(req: IncomingMessage, res: ServerResponse, pool: Pool): Promise<{ status: string, game_id: string }> {
    // Get analysis from request body
    // get body from req:
    let all_body = ""
    req.on("data", (chunk) => {
        all_body += chunk.toString();
    });
    let on_end = (_a: any) => { };
    let on_error = (_a: any) => { };
    let prom = new Promise((resolve, reject) => {
        on_end = resolve;
        on_error = reject;
    }) as Promise<string>;

    req.on("end", async () => {
        on_end(all_body);
    });

    req.on("error", (err) => {
        on_error(err);
    });


    let analysis = JSON.parse(await prom) as Analysis;

    console.log(analysis.players.length, "players in analysis for game", analysis.game_id);
    let new_state = "Completed";
    let fut: Promise<any>;
    try {
        console.log("Cleaning up previous analysis for game", analysis.game_id);
        await cleanup_previous_analysis(pool, analysis.game_id);
        console.log("Starting analysis insert for game", analysis.game_id);
        fut = finalize_and_insert_analysis(pool, analysis);
    } catch (error) {
        fut = Promise.resolve(null);
        console.error("Error finalizing and inserting analysis:", error);
        new_state = "Failed";
    }

    // Send a character every 10 seconds to keep the connection alive
    const interval = setInterval(() => {
        console.log("Keeping connection alive...");
        res.write(" "); // Send a space character to keep the connection alive
    }, 10000);

    console.log(`Inserting analysis ${analysis.game_id}`);
    let start_time = performance.now();
    try {
        await fut; // Wait for the analysis to be finalized and inserted
    } catch (error) {
        console.log("Error during analysis insertion:", error);
        new_state = "Failed";
    }
    console.log(`Finished analysis ${((performance.now() - start_time) / 1000).toFixed(2)}s`);

    // When `fut` resolves
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

export async function db_interaction_server(database: Pool): Promise<void> {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const parsedUrl = parse(req.url || '', true);
        const method = req.method;
        const pathname = parsedUrl.pathname;

        // Handle CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            if (method === 'GET' && pathname === '/retreive_game') {
                console.log(`${method} ${pathname}`);
                await get_retreive_game(req, res, database);
            } else if (method === 'GET' && pathname === '/health') {
                const healthResponse = await health();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(healthResponse));
            } else if (method === 'POST' && pathname === '/submit_game') {
                console.log(`${method} ${pathname}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                let jResponse = await post_submit_game(req, res, database);
                res.end(JSON.stringify(jResponse));
            } else {
                console.log(`${method} ${pathname}`);
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Route not found' }));
            }
        } catch (error) {
            console.error('Unhandled error in request handler:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` 
            }));
        }
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`DB Interaction Server running on port ${PORT}`);
        console.log(`Available routes:`);
        console.log(`  GET /retreive_game - retreive and process a pending game`);
        console.log(`  POST /submit_game - submit game analysis data`);
        console.log(`  GET /health - Health check`);
    });
}
