
import { Pool } from "pg";


let p = new Pool({
    port: 5432,
    host: "localhost",
    user: "postgres",
    database: "openfrontpro",
});

await p.connect();

let res = await p.query("SELECT * FROM lobbies;");
console.log("Lobbies: ", res.rows);
