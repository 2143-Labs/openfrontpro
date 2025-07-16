
import { GameRecord, GameRecordSchema } from "openfront-client/src/core/Schemas";
import { Pool } from "pg";


let p = new Pool({
    port: 5432,
    host: "localhost",
    user: "postgres",
    database: "openfrontpro",
});

await p.connect();

let res = await p.query("SELECT * FROM finished_games LIMIT 3;");
console.log("Games: ", res.rows);


for(let game of res.rows) {
    console.log("Game ID: ", game.game_id);
    let r = game.result_json;
    let game: GameRecord = GameRecordSchema.parse(r);

    console.log("Game Record: ", game.info.winner);
    await simgame(game.game_id, game);
}


async function simgame(gameId: string, record: GameRecord) {
    // TODO


}
