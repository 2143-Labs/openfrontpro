import { getServerConfig } from "openfront-client/src/core/configuration/ConfigLoader.ts";
import { DefaultConfig } from "openfront-client/src/core/configuration/DefaultConfig.ts";
import { Executor } from "openfront-client/src/core/execution/ExecutionManager.ts";
import { PseudoRandom } from "openfront-client/src/core/PseudoRandom.ts";
import {
  Cell,
  GameMapType,
  Nation,
  PlayerInfo,
  PlayerType,
  MessageType,
  UnitType,
} from "openfront-client/src/core/game/Game.ts";
import { createGame } from "openfront-client/src/core/game/GameImpl.ts";
import {
  GameMapImpl,
  type GameMap,
} from "openfront-client/src/core/game/GameMap.ts";
import {
  type GameUpdateViewData,
  ErrorUpdate,
  GameUpdateType,
  type GameUpdate,
  type DisplayMessageUpdate,
  AllianceRequestUpdate,
  PlayerUpdate,
  UnitUpdate,
} from "openfront-client/src/core/game/GameUpdates.ts";
//import { type TerrainMapData } from "openfront-client/src/core/game/TerrainMapLoader.ts";
import { GameRunner } from "openfront-client/src/core/GameRunner.ts";
import {
  type GameEndInfo,
  type GameRecord,
  type GameStartInfo,
} from "openfront-client/src/core/Schemas.ts";
import {
  decompressGameRecord,
  simpleHash,
} from "openfront-client/src/core/Util.ts";

import { Logger } from "winston";

import { Pool } from "pg";
import fs from "fs/promises";

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

  let res = await p.query(
    "SELECT fg.game_id, fg.result_json, lob.lobby_config_json FROM finished_games fg FULL JOIN lobbies lob ON lob.game_id = fg.game_id LIMIT 10",
  );
  console.log("Games: ", res.rows);

  for (let game of res.rows) {
    console.log("Game ID: ", game.game_id);
    let r = game.result_json as GameRecord;
    let record = decompressGameRecord(r);

    console.log("Game Winner: ", record.info.winner);
    await simgame(game.game_id, record, p);
  }
} catch (e) {
  console.error("Error: ", e);
}

type MapData = {
  minimap: Uint8Array;
  map: Uint8Array;
  manifest: any;
};

function game_type_from_name(name: string): GameMapType {
  for (let [k, v] of Object.entries(GameMapType)) {
    if (v === name) {
      return k as GameMapType;
    }
  }
  throw new Error(`Unknown game type: ${name}`);
}

async function load_map_data(
  maps_path: string,
  map_name: string,
): Promise<MapData> {
  //let map_type = game_type_from_name(map_name);
  let map_file_name = map_name.replace(/ /g, "").toLowerCase();

  let map_file = fs.readFile(`${maps_path}/${map_file_name}/map.bin`);
  let mini_map_file = fs.readFile(`${maps_path}/${map_file_name}/mini_map.bin`);
  let manifest_file = fs.readFile(
    `${maps_path}/${map_file_name}/manifest.json`,
    { encoding: "utf-8" },
  );

  let [map_data, mini_map_data, manifest_data] = await Promise.all([
    map_file,
    mini_map_file,
    manifest_file,
  ]);
  let manifest = JSON.parse(manifest_data);

  let map = new Uint8Array(map_data);
  let mini_map = new Uint8Array(mini_map_data);

  return {
    minimap: mini_map,
    map: map,
    manifest: manifest,
  };
}

type Analysis = {
  gameId: string;
  players: PlayerInfo[];
};

async function simgame(gameId: string, record: GameRecord, p: Pool) {
  let prod_config = getServerConfig("prod");
  let server_config = new DefaultConfig(
    prod_config,
    record.info.config,
    null,
    true,
  );
  let random = new PseudoRandom(simpleHash(gameId));

  // Load terrain
  let map_data = await load_map_data(
    "../OpenFrontIO/resources/maps",
    record.info.config.gameMap,
  );
  console.log("Map data loaded", map_data.manifest.name);
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
  let humans = record.info.players.map(
    (p) =>
      new PlayerInfo(p.username, PlayerType.Human, p.clientID, random.nextID()),
  );
  let nations = [];
  if (!record.info.config.disableNPCs) {
    nations = map_data.manifest.nations.map((n: any) => {
      let pi = new PlayerInfo(
        n.name,
        PlayerType.FakeHuman,
        null,
        random.nextID(),
      );

      let [x, y] = n.coordinates;
      let nation = new Nation(new Cell(x, y), n.strength, pi);

      return nation;
    });
  }

  let winner = record.info.winner![1];
  console.log("Winner: ", winner);
  let winner_player = humans.find((p) => p.clientID === winner)!;
  console.log("Winner Player: ", winner_player);
  let winner_id = winner_player.id;
  //process.exit(1)

  let is_game_update = (
    update: GameUpdateViewData | ErrorUpdate,
  ): update is GameUpdateViewData => {
    if ((update as GameUpdateViewData).tick) {
      return true;
    }
    return false;
  };

  // Simulate the game
  let game = createGame(
    humans,
    nations,
    map_impl,
    mini_map_impl,
    server_config,
  );
  const runner = new GameRunner(
    game,
    new Executor(game, gameId, "openfrontpro"),
    async (gu) => {
      if (!is_game_update(gu)) {
        console.error("Error Update: ", gu);
        return;
      }

      function messageTypeToString(type: MessageType): string {
        switch (type) {
          case MessageType.ATTACK_FAILED:
            return "ATTACK_FAILED";
          case MessageType.ATTACK_CANCELLED:
            return "ATTACK_CANCELLED";
          case MessageType.ATTACK_REQUEST:
            return "ATTACK_REQUEST";
          case MessageType.CONQUERED_PLAYER:
            return "CONQUERED_PLAYER";
          case MessageType.MIRV_INBOUND:
            return "MIRV_INBOUND";
          case MessageType.NUKE_INBOUND:
            return "NUKE_INBOUND";
          case MessageType.HYDROGEN_BOMB_INBOUND:
            return "HYDROGEN_BOMB_INBOUND";
          case MessageType.NAVAL_INVASION_INBOUND:
            return "NAVAL_INVASION_INBOUND";
          case MessageType.SAM_MISS:
            return "SAM_MISS";
          case MessageType.SAM_HIT:
            return "SAM_HIT";
          case MessageType.CAPTURED_ENEMY_UNIT:
            return "CAPTURED_ENEMY_UNIT";
          case MessageType.UNIT_CAPTURED_BY_ENEMY:
            return "UNIT_CAPTURED_BY_ENEMY";
          case MessageType.UNIT_DESTROYED:
            return "UNIT_DESTROYED";
          case MessageType.ALLIANCE_ACCEPTED:
            return "ALLIANCE_ACCEPTED";
          case MessageType.ALLIANCE_REJECTED:
            return "ALLIANCE_REJECTED";
          case MessageType.ALLIANCE_REQUEST:
            return "ALLIANCE_REQUEST";
          case MessageType.ALLIANCE_BROKEN:
            return "ALLIANCE_BROKEN";
          case MessageType.ALLIANCE_EXPIRED:
            return "ALLIANCE_EXPIRED";
          case MessageType.SENT_GOLD_TO_PLAYER:
            return "SENT_GOLD_TO_PLAYER";
          case MessageType.RECEIVED_GOLD_FROM_PLAYER:
            return "RECEIVED_GOLD_FROM_PLAYER";
          case MessageType.RECEIVED_GOLD_FROM_TRADE:
            return "RECEIVED_GOLD_FROM_TRADE";
          case MessageType.SENT_TROOPS_TO_PLAYER:
            return "SENT_TROOPS_TO_PLAYER";
          case MessageType.RECEIVED_TROOPS_FROM_PLAYER:
            return "RECEIVED_TROOPS_FROM_PLAYER";
          case MessageType.CHAT:
            return "CHAT";
          case MessageType.RENEW_ALLIANCE:
            return "RENEW_ALLIANCE";
        }
      }

      record.info.players[0].persistentID;

      //console.log("Game Update at tick: ", gu.tick);
      //console.log(gu.playerNameViewData);
      for (let [key, enum_value] of Object.entries(GameUpdateType)) {
        let ups: GameUpdate[] = gu.updates[enum_value] || [];
        if (ups.length === 0) {
          continue;
        }
        for (let up of ups) {
          // @ts-ignore
          up.type = key;
        }

        if (enum_value === GameUpdateType.Unit) {
          ups = ups.filter((u: UnitUpdate) => u.unitType != UnitType.TradeShip);
          //for(let up of ups) {
          //let unit_update = up as UnitUpdate;

          //}
          //Trade ship, warship
          continue; //TODO
        }
        if (enum_value === GameUpdateType.Hash) {
          continue;
        }
        if (enum_value === GameUpdateType.DisplayEvent) {
          for (let up of ups) {
            let display_update = up as DisplayMessageUpdate;
            let message_type = messageTypeToString(display_update.messageType);
            // @ts-ignore
            up.messageType = message_type;

            // SQL table definition:
            // let d = await p.query(`
            //   INSERT INTO
            //     analysis.display_events (game_id, tick, message_type, message, player_id, gold_amount)
            //     VALUES ($1, $2, $3, $4, $5, $6)
            //   `, TODO
            //  );
          }

          continue;
        }

        if (enum_value === GameUpdateType.Player) {
          let winner = ups.filter((u: PlayerUpdate) => u.id === winner_id);
          if (gu.tick % 10 === 0) {
            //console.log(`T${gu.tick}: Player Update: `, winner[0]);
          }

          for (let up of ups) {
            let update = up as PlayerUpdate;
            let isAliveBit = update.isAlive ? 1 : 0;
            let isConnectedBit = !update.isDisconnected ? 1 : 0;
            let player_status = isAliveBit | (isConnectedBit << 1);

            let new_db_item = {
              game_id: gameId,
              id: update.id,
              tick: gu.tick,
              player_status: player_status,
              tiles_owned: update.tilesOwned,
              gold: update.gold,
              workers: update.workers,
              troops: update.troops,
              target_troop_ratio: Math.floor(update.targetTroopRatio * 1000),
            };

            // SQL table definition:

            //let d = await p.query(`
            //INSERT INTO
            //analysis.player_updates (game_id, id, player_status, tiles_owned, gold, workers, troops, target_troop_ratio, tick)
            //VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            //ON CONFLICT (game_id, id, tick) DO UPDATE
            //`, new_db_item);

            //if(d.rowCount === 0) {
            //throw new Error(`Failed to insert player update for game ${gameId} at tick ${gu.tick}`);
            //}
          }

          continue;
        }

        //if (enum_value === GameUpdateType.BonusEvent) {
        // Troops/Workers/Gold bonus
        // in ffa it's only for bots
        //continue;
        //}
        // function gameUpdateTypeToString(
        //   type: GameUpdateType,
        // ): string {
        //   switch (type) {
        //     case GameUpdateType.Tile:
        //         return "Tile";
        //     case GameUpdateType.Unit:
        //         return "Unit";
        //     case GameUpdateType.Player:
        //         return "Player";
        //     case GameUpdateType.DisplayEvent:
        //         return "DisplayEvent";
        //     case GameUpdateType.DisplayChatEvent:
        //         return "DisplayChatEvent";
        //     case GameUpdateType.AllianceRequest:
        //         return "AllianceRequest";
        //     case GameUpdateType.AllianceRequestReply:
        //         return "AllianceRequestReply";
        //     case GameUpdateType.BrokeAlliance:
        //         return "BrokeAlliance";
        //     case GameUpdateType.AllianceExpired:
        //         return "AllianceExpired";
        //     case GameUpdateType.AllianceExtension:
        //         return "AllianceExtension";
        //     case GameUpdateType.TargetPlayer:
        //         return "TargetPlayer";
        //     case GameUpdateType.Emoji:
        //         return "Emoji";
        //     case GameUpdateType.Win:
        //         return "Win";
        //     case GameUpdateType.Hash:
        //         return "Hash";
        //     case GameUpdateType.UnitIncoming:
        //         return "UnitIncoming";
        //     case GameUpdateType.BonusEvent:
        //         return "BonusEvent";
        //     case GameUpdateType.RailroadEvent:
        //         return "RailroadEvent";
        //   }
        // }
        //
        // SQL enum definition: Events:

        for (let up of ups) {
          // Remove type from the update to save space
          // @ts-ignore
          delete up.type;

          let new_db_item = {
            game_id: gameId,
            tick: gu.tick,
            event_type: key,
            data: up,
          };

          // let d = await p.query(`
          // INSERT INTO
          //   analysis.general_events (game_id, tick, event_type, data)
          // VALUES ($1, $2, $3, $4)
          // `, new_db_item);
          console.log(`T${gu.tick}: Update for ${key} (${enum_value}):`, up);
        }
      }
      //console.log(gu.updates);
      //let tus: [number, number][] = [];
      //for(let tu of gu.packedTileUpdates) {
      //let x = map_impl.x(tu);
      //let y = map_impl.y(tu);

      //tus.push({
      //x, y
      //});
      //}
      //console.log("Tile Updates: ", tus);
    },
  );
  runner.init();

  for (let [i, turn] of record.turns.entries()) {
    runner.addTurn(turn);
    runner.executeNextTick();
  }

  return {
    gameId: gameId,
    players: humans,
  } satisfies Analysis;
}
