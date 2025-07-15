#!/usr/bin/env fish

jq ".lobbies[0] | {gameID: .gameID, teams: .gameConfig.playerTeams, maxPlayers: .gameConfig.maxPlayers, gameMap: .gameConfig.gameMap}" -c matches.txt | uniq
