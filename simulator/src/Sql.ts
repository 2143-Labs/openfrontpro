import { Pool } from "pg";

function format_sql(strings: TemplateStringsArray, ...values: any[]): string {
    return strings.reduce(
        (acc, str, index) => acc + str + (values[index] || ""),
        "",
    );
}

export const INSERT_SPAWN_LOCATIONS = format_sql`
  INSERT INTO analysis_1.spawn_locations (game_id, client_id, tick, x, y, previous_spawns)
  VALUES ($1, $2, $3, $4, $5, $6)
`;

export const UPSERT_COMPLETED_ANALYSIS = format_sql`
  INSERT INTO analysis_1.completed_analysis (game_id, analysis_engine_version)
  VALUES ($1, $2)
  ON CONFLICT (game_id) DO UPDATE
  SET inserted_at_unix_sec = EXTRACT(EPOCH FROM NOW()),
      analysis_engine_version = $2
`;

export const INSERT_DISPLAY_EVENT = format_sql`
  INSERT INTO
    analysis_1.display_events (game_id, tick, message_type, message, player_id, gold_amount)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING tick
`;

export const INSERT_DISPLAY_EVENT_PACKED = format_sql`
  INSERT INTO
    analysis_1.display_events (game_id, tick, message_type, message, player_id, gold_amount)
  VALUES %L
`;

export const INSERT_PLAYER = format_sql`
  INSERT INTO
    analysis_1.players (
      game_id, id, client_id, small_id, player_type, name, flag, team
    )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

export const INSERT_GENERAL_EVENT = format_sql`
  INSERT INTO
    analysis_1.general_events (game_id, tick, event_type, data)
  VALUES ($1, $2, $3, $4)
  RETURNING tick
`;

export const INSERT_GENERAL_EVENT_PACKED = format_sql`
  INSERT INTO
    analysis_1.general_events (game_id, tick, event_type, data)
  VALUES %L
`;

export const SELECT_AND_UPDATE_JOB = format_sql`
  WITH my_job AS (
    SELECT
      fg.game_id, fg.result_json
    FROM
      finished_games fg
    INNER JOIN analysis_queue aq ON aq.game_id = fg.game_id
    WHERE
      aq.status = 'Pending'
    ORDER BY
      fg.inserted_at_unix_sec ASC
    LIMIT 1
  )
  UPDATE analysis_queue aq
  SET
    status = 'Running',
    started_unix_sec = EXTRACT(EPOCH FROM NOW())
  FROM my_job
  WHERE aq.game_id = my_job.game_id AND aq.status = 'Pending'
  RETURNING my_job.game_id, my_job.result_json
`;

export const UPDATE_ANALYSIS_QUEUE_STATUS = format_sql`
  UPDATE analysis_queue
  SET
    status = $2
  WHERE
    game_id = $1
    AND status in ('Pending', 'Running')
`;

export const INSERT_PLAYER_UPDATE_NEW = format_sql`
  INSERT INTO
    analysis_1.packed_player_updates (game_id, small_id, tick, player_alive, player_connected, tiles_owned, gold, workers, troops)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING tick
`;

export const INSERT_PLAYER_UPDATE_NEW_PACKED = format_sql`
  INSERT INTO
    analysis_1.packed_player_updates (game_id, small_id, tick, player_alive, player_connected, tiles_owned, gold, workers, troops)
    VALUES %L
`;

export const INSERT_PLAYER_TROOP_RATIO_CHANGE = format_sql`
    INSERT INTO
        analysis_1.troop_ratio_change (game_id, small_id, client_id, target_troop_ratio)
    VALUES ($1, $2, $3, $4)
`;


export const INSERT_CONSTRUCTION_EVENT = format_sql`
    INSERT INTO
        analysis_1.construction_events (game_id, client_id, small_id, tick, unit_type, x, y, level)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;



// ===== Database cleanup helpers =====
export async function cleanup_previous_analysis(
    pool: Pool,
    gameId: string,
): Promise<void> {
    const tableNames = [
        "general_events",
        "display_events",
        "completed_analysis",
        "players",
        "spawn_locations",
        "packed_player_updates",
        "troop_ratio_change",
    ];

    for (const tableName of tableNames) {
        try {
            const deleteQuery = `DELETE FROM analysis_1.${tableName} WHERE game_id = $1;`;
            await pool.query(deleteQuery, [gameId]);
        } catch (error) {
            throw new Error(`Failed to delete from ${tableName}: ${error}`);
        }
    }
}
