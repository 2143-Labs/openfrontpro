import { getServerConfig } from "openfront-client/src/core/configuration/ConfigLoader.ts";
import { PseudoRandom } from "openfront-client/src/core/PseudoRandom.ts";
import { DefaultConfig } from 'openfront-client/src/core/configuration/DefaultConfig.ts';
import { prodConfig } from 'openfront-client/src/core/configuration/ProdConfig.ts';
import { Executor } from 'openfront-client/src/core/execution/ExecutionManager.ts';
import { Cell, GameMapType, Nation, PlayerInfo, PlayerType } from 'openfront-client/src/core/game/Game.ts';
import { createGame } from 'openfront-client/src/core/game/GameImpl.ts';
import { GameMapImpl, type GameMap } from 'openfront-client/src/core/game/GameMap.ts';
import { GameUpdateViewData, ErrorUpdate } from 'openfront-client/src/core/game/GameUpdates.ts';
import { type TerrainMapData } from 'openfront-client/src/core/game/TerrainMapLoader.ts';
import { GameRunner } from 'openfront-client/src/core/GameRunner.ts';
import { type GameEndInfo, type GameRecord, type GameStartInfo } from 'openfront-client/src/core/Schemas.ts';
import { decompressGameRecord, simpleHash } from 'openfront-client/src/core/Util.ts';

import { Logger } from "winston";

import { Pool } from "pg";
import fs from "fs/promises";
import { Config } from "openfront-client/src/core/configuration/Config.ts";

export let base_log = new Logger();


try {
    let p = new Pool({
        port: 5432,
        host: "localhost",
        user: "postgres",
        database: "openfrontpro",
    });

    await p.connect();
    console.log("Connected to database");

    let res = await p.query("SELECT fg.game_id, fg.result_json, lob.lobby_config_json FROM finished_games fg LEFT JOIN lobbies lob ON lob.game_id = fg.game_id LIMIT 3;");
    console.log("Games: ", res.rows);


    for(let game of res.rows) {
        console.log("Game ID: ", game.game_id);
        let r = game.result_json as GameRecord;
        let record = decompressGameRecord(r);

        console.log("Game Winner: ", record.info.winner);
        await simgame(game.game_id, record);
    }

} catch (e) {
    console.error("Error: ", e);
}

type MapData = {
    minimap: Uint8Array;
    map: Uint8Array;
    manifest: any;
}

function game_type_from_name(name: string): GameMapType {
    for(let [k, v] of Object.entries(GameMapType)) {
        if(v === name){
            return k as GameMapType;
        }
    }
    throw new Error(`Unknown game type: ${name}`);
}

async function load_map_data(maps_path: string, map_name: string): Promise<MapData> {
    //let map_type = game_type_from_name(map_name);
    let map_file_name = map_name.replace(/ /g, "").toLowerCase();

    let map_file = fs.readFile(`${maps_path}/${map_file_name}/map.bin`);
    let mini_map_file = fs.readFile(`${maps_path}/${map_file_name}/mini_map.bin`);
    let manifest_file = fs.readFile(`${maps_path}/${map_file_name}/manifest.json`, { encoding: "utf-8" });

    let [map_data, mini_map_data, manifest_data] = await Promise.all([map_file, mini_map_file, manifest_file]);
    let manifest = JSON.parse(manifest_data);

    let map = new Uint8Array(map_data);
    let mini_map = new Uint8Array(mini_map_data);

    return {
        minimap: mini_map,
        map: map,
        manifest: manifest
    };
}

await load_map_data("../OpenFrontIO/resources/maps", "Africa");

async function simgame(gameId: string, record: GameRecord) {
    let prod_config = getServerConfig("prod")
    let server_config = new DefaultConfig(prod_config, record.info.config, null, true);
    let random = new PseudoRandom(simpleHash(gameId));

    // Load terrain
    let map_data = await load_map_data("../OpenFrontIO/resources/maps", record.info.config.gameMap);
    console.log("Map data loaded", map_data.manifest);
    let map_impl = new GameMapImpl(
        map_data.manifest.map.width,
        map_data.manifest.map.height,
        map_data.map,
        map_data.manifest.map.num_land_tiles,
    );

    let mini_map_impl = new GameMapImpl(
        map_data.manifest.mini_map.width,
        map_data.manifest.mini_map.height,
        map_data.minimap,
        map_data.manifest.mini_map.num_land_tiles,
    );


    // Create players and nations
    let humans = record.info.players.map(p => new PlayerInfo(p.flag, p.username, PlayerType.Human, p.clientID, random.nextID()));
    let nations = [];
    if(!record.info.config.disableNPCs) {
        nations = map_data.manifest.nations.map((n: any) => {
            let [x, y] = n.coordinates;
            return new Nation(
                new Cell(x, y),
                n.strength,
                new PlayerInfo(n.flag, n.name, PlayerType.FakeHuman, null, random.nextID()),
            );
        });
    }

    // Simulate the game
    let game = createGame(humans, nations, map_impl, mini_map_impl, server_config);
    const runner = new GameRunner(game, new Executor(game, gameId, "openfrontpro"), (gu) => {
        if(!gu.tick) {

        }
        console.log("Game Update: ", gu.tick);

    });
    runner.init();

    for (let [i, turn] of record.turns.entries()) {
      runner.addTurn(turn);
      runner.executeNextTick();
    }
}
