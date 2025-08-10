import { Pool } from "pg";


export async function test_ply(
    pool: Pool,
): Promise<void> {
    let now = performance.now();
    console.log(`Testing packed player updates for game '24S9W61z'`);
    let res = await pool.query(`SELECT
        ply_upds.tick,
        ply_upds.tiles_owned,
        ply_upds.gold,
        ply_upds.workers,
        ply_upds.troops,
        ply_upds.small_id as "small_id: i16"
    FROM
        analysis_1.packed_player_updates ply_upds
    WHERE
    ply_upds.game_id = '24S9W61z'
    `);
    console.log(`Testing packed player updates for game '24S9W61z' completed.`);
    console.log(`Number of packed player updates: ${res.rowCount}`);

    console.log("random row" + JSON.stringify(res.rows[Math.floor(Math.random() * res.rowCount)]));


    console.log(`Testing player retrieval for game '24S9W61z'`);
    let res2 = await pool.query(`        SELECT
            p.id,
            p.client_id,
            p.small_id,
            p.player_type as "player_type: String",
            p.name,
            p.flag,
            p.team,
            s.tick as "spawn_tick: Option<i16>",
            s.x as "spawn_x: Option<i32>",
            s.y as "spawn_y: Option<i32>",
            s.previous_spawns as "previous_spawns: serde_json::Value"
        FROM
            analysis_1.players p
            LEFT JOIN analysis_1.spawn_locations s
                ON  p.game_id = s.game_id
                AND p.client_id = s.client_id
        WHERE
            p.game_id = '24S9W61z'
    `);
    console.log(`Testing player retrieval for game '24S9W61z' completed.`);
    console.log(`Number of players: ${res2.rowCount}`);
    console.log("random player row: " + JSON.stringify(res2.rows[Math.floor(Math.random() * res2.rowCount)]));

    let total_time = performance.now() - now;
    console.log(`Total time taken for tests: ${(total_time / 1000).toFixed(1)}s.`);
    console.log("Test completed.");
}
