import { getServerConfig } from "openfront-client/src/core/configuration/ConfigLoader.ts";
import { DefaultConfig } from "openfront-client/src/core/configuration/DefaultConfig.ts";
import { Executor } from "openfront-client/src/core/execution/ExecutionManager.ts";
import {
    Cell,
    Game,
    GameMapType,
    MessageType,
    Nation,
    PlayerInfo,
    PlayerType,
    UnitType,
} from "openfront-client/src/core/game/Game.ts";
import { createGame } from "openfront-client/src/core/game/GameImpl.ts";
import { GameMapImpl, TileRef } from "openfront-client/src/core/game/GameMap.ts";
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
import { change_big_int_to_string_recursively, compress_value_for_db, load_map_data, setup } from "./Util";
import { INSERT_DISPLAY_EVENT, INSERT_GENERAL_EVENT, INSERT_PLAYER, INSERT_PLAYER_TROOP_RATIO_CHANGE, INSERT_PLAYER_UPDATE_NEW, INSERT_SPAWN_LOCATIONS, SELECT_AND_UPDATE_JOB, UPDATE_ANALYSIS_QUEUE_STATUS, UPSERT_COMPLETED_ANALYSIS } from "./Sql";


// ===== Simulation helpers =====
export async function simgame(gameId: string, record: GameRecord): Promise<Analysis> {
    const prod_config = getServerConfig("prod");
    const server_config = new DefaultConfig(
        prod_config,
        record.info.config,
        null,
        true,
    );
    const random = new PseudoRandom(simpleHash(gameId));

    // Load terrain
    const map_data = await load_map_data(
        "./OpenFrontIO/resources/maps",
        record.info.config.gameMap,
    );
    console.log("Map data loaded", map_data.manifest.name);
    const map_impl = new GameMapImpl(
        map_data.manifest.map.width,
        map_data.manifest.map.height,
        map_data.map,
        map_data.manifest.map.num_land_tiles,
    );

    const mini_map_impl = new GameMapImpl(
        map_data.manifest.mini_map.width,
        map_data.manifest.mini_map.height,
        map_data.minimap,
        map_data.manifest.mini_map.num_land_tiles,
    );

    // Create players and nations
    const humans = record.info.players.map(
        (p) =>
            new PlayerInfo(
                p.username,
                PlayerType.Human,
                p.clientID,
                random.nextID(),
            ),
    );
    let nations = [];
    if (!record.info.config.disableNPCs) {
        nations = map_data.manifest.nations.map((n: any) => {
            const pi = new PlayerInfo(
                n.name,
                PlayerType.FakeHuman,
                null,
                random.nextID(),
            );

            const [x, y] = n.coordinates;
            const nation = new Nation(new Cell(x, y), n.strength, pi);

            return nation;
        });
    }

    const winner = record.info.winner![1];
    console.log("Winner: ", winner);
    const winner_player = humans.find((p) => p.clientID === winner)!;
    console.log("Winner Player: ", winner_player);
    //let winner_id = winner_player.id;
    //process.exit(1)

    console.log("Clear complete. Starting analysis.", gameId);

    const game = createGame(
        humans,
        nations,
        map_impl,
        mini_map_impl,
        server_config,
    );

    // This is a mutable object that we pass to every call to handle_game_update
    // Used to store data that we care about between turns, but doesn't make the analysis
    let extra_data: ExtraData = {
        players_died_on_turn: {},
        players_disconnected_on_turn: {},
        players_troop_ratio: {},
        last_tick_update_time: performance.now(),
        players_structures_owned: {},
        players_units_owned: {},
    };

    // This is the actual result of the analysis
    let analysis: Analysis = {
        game_id: gameId,
        players: humans,
        spawns: {},
        ins_troop_ratio: [],
        ins_general_event: [],
        ins_display_event: [],
        ins_player: [],
        ins_player_update: [],
        ins_construction: [],
    };


    // -1 means unlimited. Game ends at 0;
    let simulation_turns_left = -1;
    const runner = new GameRunner(
        game,
        new Executor(game, gameId, "openfrontpro"),
        async (gu) => {
            const has_won = await handle_game_update(game, gu, record, extra_data, analysis);
            if (simulation_turns_left === -1 && has_won) {
                simulation_turns_left = 5;
            }
        },
    );


    // Run the simulation: this modifies the analysis and extra_data objects
    await run_simulation(runner, record, analysis, extra_data, map_impl);
    console.log("Simulation complete. Finalizing analysis.");

    return analysis;
}

// ===== Analysis =====
async function run_simulation(runner: GameRunner, record: GameRecord, analysis: Analysis, extraData: ExtraData, mapImpl: GameMapImpl) {
    runner.init();
    let simulation_turns_left = -1;
    for (const turn of record.turns) {
        await analyze_intents(turn, record, analysis, extraData, mapImpl);
        runner.addTurn(turn);
        runner.executeNextTick();
        //await new Promise((resolve) => setTimeout(resolve, 10));
        if (simulation_turns_left === 0) {
            console.log("Player has won, stopping simulation.");
            return;
        } else if (simulation_turns_left > 0) {
            console.log("Simulation turns left: ", simulation_turns_left);
            simulation_turns_left--;
        }

        //sleep 1ms
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
}

async function analyze_intents(
    turn: Turn,
    _record: GameRecord,
    analysis: Analysis,
    extra_data: ExtraData,
    map_impl: GameMapImpl,
): Promise<void> {
    for (const intent of turn.intents) {
        if (intent.type !== "spawn") {
            continue;
        }

        const client_id = intent.clientID;
        let tile = intent.tile;
        const x = map_impl.x(tile)
        const y = map_impl.y(tile);
        console.log(`Player ${client_id} spawned at (${x}, ${y})`);

        // TODO fix this
        const prev_spawns = [...(analysis.spawns[client_id]?.previous_spawns || []), {x, y, turn: turn.turnNumber}];
        console.log(`Previous spawns: ${prev_spawns.length}`);
        console.log(analysis.spawns[client_id]);

        // Store the spawn location
        analysis.spawns[client_id] = {
            x,
            y,
            turn: turn.turnNumber,
            previous_spawns: prev_spawns,
        };
    }
}

// ===== Game-update helpers =====
const is_game_update = (
    update: GameUpdateViewData | ErrorUpdate,
): update is GameUpdateViewData => {
    if ((update as GameUpdateViewData).tick) {
        return true;
    }
    return false;
};

/// Function to handle game updates. Returns true if the game is finished.
async function handle_game_update(
    game: Game,
    gu: GameUpdateViewData | ErrorUpdate,
    record: GameRecord,
    extra_data: ExtraData,
    analysis: Analysis,
): Promise<boolean> {
    const game_id = record.info.gameID;
    let game_is_won = false;

    if (!is_game_update(gu)) {
        console.error("Error Update: ", gu);
        return false;
    }

    for (const tile_update of gu.packedTileUpdates) {
        // Extract tile reference and state from the TileUpdate
        // Last 16 bits are state, rest is tile reference
        //const tileRef = Number(tile_update >> 16n);
        //const state = Number(tile_update & 0xffffn);

        //console.log(`Tile Update: ${tileRef} -> ${state}`);
    }

    for (const ply of game.allPlayers()) {
        if(!ply.clientID()) {
            continue; // Skip players without a client ID
        }

        type ConstructionMap = Partial<Record<UnitType, Record<TileRef, number>>>;

        function empty_construction_map(): ConstructionMap {
            return {
                [UnitType.City]: {},
                [UnitType.Construction]: {},
                [UnitType.DefensePost]: {},
                [UnitType.SAMLauncher]: {},
                [UnitType.MissileSilo]: {},
                [UnitType.Port]: {},
                [UnitType.Factory]: {},
            };
        }

        let constructions = empty_construction_map();

        // TODO impl these
        let wandering_units = {
            [UnitType.Warship]: {},
            [UnitType.HydrogenBomb]: {},
            [UnitType.MIRV]: {},
            [UnitType.AtomBomb]: {},
        };

        for (const unit of ply.units()) {
            if (unit.type() === UnitType.Construction) {
                let map = constructions[unit.constructionType()!]!;
                map[unit.tile()] = unit.level();
            }
        }

        let old_constructions: ConstructionMap = extra_data.players_structures_owned[ply.clientID()!];
        if(old_constructions !== constructions) {
            extra_data.players_structures_owned[ply.clientID()!] = constructions;

            if(!old_constructions) {
                // Its the first time we have seen this player, hopefully they have no structures
                continue;
            }

            //Find the difference between old and new constructions
            let new_constructions = empty_construction_map();
            let missing_old_constructions = empty_construction_map();
            let upgraded_old_constructions = empty_construction_map();

            let has_new_constructions = false;
            let has_missing_old_constructions = false;
            let has_upgraded_old_constructions = false;

            // TODO: dedup
            // New Constructions
            for (const [unit_type, new_map] of Object.entries(constructions)) {
                const old_map = old_constructions[unit_type as UnitType];

                for (const [tile, level] of Object.entries(new_map)) {
                    if (old_map![tile] !== level) {
                        has_new_constructions = true;
                        new_constructions[unit_type as UnitType]![tile] = level;
                    }
                }
            }

            // Constructions that aren't there anymore
            for (const [unit_type, old_map] of Object.entries(old_constructions)) {
                const new_map = constructions[unit_type as UnitType];

                for (const [tile, level] of Object.entries(old_map)) {
                    if (new_map![tile] > level) {
                        has_upgraded_old_constructions = true;
                        upgraded_old_constructions[unit_type as UnitType]![tile] = level;
                    } else if (!new_map![tile]) {
                        has_missing_old_constructions = true;
                        missing_old_constructions[unit_type as UnitType]![tile] = level;
                    }
                }
            }

            // Now, for each new construction, we need to insert it into the analysis
            if(has_new_constructions){
                console.log("New constructions for player(tick)", ply.clientID(), gu.tick, new_constructions);
                for (const [unit_type, new_map] of Object.entries(new_constructions)) {
                    for (const [tile, level] of Object.entries(new_map)) {
                        const x = game.map().x(Number(tile));
                        const y = game.map().y(Number(tile));
                        console.log(`Player ${ply.clientID()} built ${UnitType[unit_type as unknown as UnitType]}(level ${level}) at (${x}, ${y}) on turn ${gu.tick}`);

                        analysis.ins_construction.push([
                            game_id,
                            ply.clientID()!,
                            ply.smallID(),
                            gu.tick,
                            unit_type as unknown as UnitType,
                            x,
                            y,
                            level,
                        ]);
                    }
                }
            }
            // TODO: This never happens
            if(has_missing_old_constructions) {
                console.log("Missing old constructions for player(tick)", ply.clientID(), gu.tick, missing_old_constructions);
                //process.exit(1);
            }
            // TODO: This never happens
            if(has_upgraded_old_constructions) {
                console.log("Upgraded old constructions for player(tick)", ply.clientID(), gu.tick, upgraded_old_constructions);
                //process.exit(1);
            }
        }

    }

    for (const [key, enum_value] of Object.entries(GameUpdateType)) {
        const ups: GameUpdate[] = gu.updates[enum_value] || [];
        if (ups.length === 0) {
            continue;
        }

        // Add type information to updates
        ups.forEach((up) => {
            (up as any).type = key;
        });

        switch (enum_value) {
            case GameUpdateType.Unit:
                // Filter out trade ships and skip processing for now
                const filteredUps = ups.filter(
                    (u: UnitUpdate) => u.unitType !== UnitType.TradeShip,
                );
                continue; // TODO

            case GameUpdateType.Hash:
                continue;

            case GameUpdateType.DisplayEvent:
                await process_display_events(ups, game_id, gu.tick, analysis);
                break;

            case GameUpdateType.Player:
                await process_player_updates(
                    ups,
                    game_id,
                    gu.tick,
                    extra_data,
                    analysis,
                );
                break;

            case GameUpdateType.Win:
                game_is_won = true;
                // fall through

            default:
                await process_general_events(ups, game_id, gu.tick, analysis, key);
                break;
        }
    }

    const num_print_ticks = 300;
    const should_log_tick = gu.tick % num_print_ticks === (num_print_ticks - 1);
    if (should_log_tick) {
        let tick_time_ms = performance.now() - (extra_data.last_tick_update_time || 0);
        let ticks_per_sec = (num_print_ticks * 1000 / tick_time_ms).toFixed(2);
        console.log(`Game Update: ${gu.tick + 1} ticks. ${ticks_per_sec}t/s.`);
        extra_data.last_tick_update_time = performance.now();
    }

    return game_is_won;
}

// Helper functions
async function process_display_events(
    ups: GameUpdate[],
    game_id: string,
    tick: number,
    analysis: Analysis,
) {
    for (const up of ups) {
        const displayUpdate = up as DisplayMessageUpdate;
        const messageType = MessageType[displayUpdate.messageType];
        (up as any).messageType = messageType;

        analysis.ins_display_event.push([
            game_id,
            tick,
            displayUpdate.messageType,
            displayUpdate.message,
            displayUpdate.playerID,
            displayUpdate.goldAmount,
        ]);
    }
}

async function process_player_updates(
    ups: GameUpdate[],
    game_id: string,
    tick: number,
    extra_data: ExtraData,
    analysis: Analysis,
) {
    if (tick % 10 !== 0) {
        return;
    }

    for (const up of ups) {
        const update = up as PlayerUpdate;
        const is_alive_bit = update.isAlive ? 1 : 0;
        const is_connected_bit = !update.isDisconnected ? 1 : 0;

        const disconnected_at =
            extra_data.players_disconnected_on_turn[update.id];
        const player_is_disconnected_long =
            disconnected_at && disconnected_at + 15 < tick;
        const should_look_for_disconnects =
            tick > 301 && update.isDisconnected && !disconnected_at;
        const should_ignore_this_bot =
            tick > 15 && update.playerType === PlayerType.Bot;

        if (should_look_for_disconnects) {
            extra_data.players_disconnected_on_turn[update.id] = tick;
        }

        if (tick === 300) {
            analysis.ins_player.push([
                game_id,
                update.id,
                update.clientID,
                update.smallID,
                update.playerType,
                update.name,
                null,
                typeof update.team === "string" ? null : update.team,
            ]);
        }

        if (player_is_disconnected_long) {
            continue;
        }

        if (should_ignore_this_bot) {
            continue;
        }

        if(update.tilesOwned == 0 && update.gold == 0n && !update.clientID) {
            continue; // Ignore Nations that have no tiles and no gold
        }

        analysis.ins_player_update.push([
            game_id,
            update.smallID,
            tick,
            is_alive_bit,
            is_connected_bit,
            compress_value_for_db(update.tilesOwned),
            compress_value_for_db(update.gold),
            compress_value_for_db(12), // they removed workers
            compress_value_for_db(update.troops),
        ]);

        let last_troop_ratio = extra_data.players_troop_ratio?.[update.id];
        if(update.targetTroopRatio !== last_troop_ratio && update.playerType === PlayerType.Human) {
            analysis.ins_troop_ratio.push([
                game_id,
                update.smallID,
                update.clientID,
                update.targetTroopRatio,
            ]);
            extra_data.players_troop_ratio[update.id] = update.targetTroopRatio;
        }
    }
}

async function process_general_events(
    ups: GameUpdate[],
    game_id: string,
    tick: number,
    analysis: Analysis,
    key: string,
) {
    for (const up of ups) {
        delete (up as any).type;

        analysis.ins_general_event.push([
            game_id,
            tick,
            key,
            change_big_int_to_string_recursively(up),
        ]);
    }
}

