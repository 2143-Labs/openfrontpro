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
export let { DATABASE_URL, MAP_FOLDER, FINALIZE_METHOD } = process.env;
if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
}

if (!MAP_FOLDER) {
    MAP_FOLDER = "./OpenFrontIO/resources/maps";
}

if (!FINALIZE_METHOD) {
    FINALIZE_METHOD = "db";
}

export type MapData = {
    minimap: Uint8Array;
    map: Uint8Array;
    manifest: any;
};

export type PlayerSpawn = {
    turn: number;
    x: number;
    y: number;
    previous_spawns: PlayerSpawn[];
};

export type Analysis = {
    game_id: string;
    players: PlayerInfo[];
    spawns: Record<string, PlayerSpawn>;

    ins_troop_ratio: any[][];
    ins_general_event: any[][];
    ins_display_event: any[][];
    ins_player: any[][];
    ins_player_update: any[][];
};

export type ExtraData = {
    players_died_on_turn: Record<string, number>;
    players_disconnected_on_turn: Record<string, number>;
    players_troop_ratio: Record<string, number>;
    last_tick_update_time: number;
};
