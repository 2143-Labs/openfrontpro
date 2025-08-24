
-- //analysis.ins_construction.push([
-- //game_id,
-- //ply.clientID()!,
-- //ply.smallID(),
-- //gu.tick,
-- //unit_type as unknown as UnitType,
-- //x,
-- //y,
-- //level,
-- //]);


CREATE TABLE IF NOT EXISTS analysis_1.construction_events (
    game_id CHAR(8) NOT NULL,
    client_id CHAR(8) NOT NULL,
    small_id SMALLINT NOT NULL,
    tick SMALLINT NOT NULL,
    unit_type TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    level SMALLINT NOT NULL,
);
