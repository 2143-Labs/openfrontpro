import { GameRecord, GameRecordSchema } from "openfront-client/src/core/Schemas";
import { readFile } from "fs/promises";

console.log("Hello world!");

let x = await readFile("./gamedata/7a5eu6eJ.json");

let gameRecordJson = JSON.parse(x.toString());
let game: GameRecord = GameRecordSchema.parse(gameRecordJson);

console.log("Game Record: ", game.info.winner);
