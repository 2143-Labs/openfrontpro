import { GameConfig, GameRecord, GameRecordSchema } from "openfront-client/src/core/Schemas.ts";
import { GameServer } from "openfront-client/src/server/GameServer.ts";
import { getServerConfig } from "openfront-client/src/core/configuration/ConfigLoader.ts";

import { Logger } from "winston";

import { Pool } from "pg";

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
        let r = game.result_json;
        let gamer: GameRecord = GameRecordSchema.parse(r);

        console.log("Game Record: ", gamer.info.winner);
        await simgame(game.game_id, gamer);
    }

} catch (e) {
    console.error("Error: ", e);
}



async function simgame(gameId: string, record: GameRecord) {
    //init:
    let server_config = getServerConfig("prod");
    let game = new GameServer(gameId, base_log, Date.now(), server_config, record.info.config);

    game.prestart();
    await new Promise(resolve => setTimeout(resolve, 1000)); // wait for prestart to finish
    game.start();

}
