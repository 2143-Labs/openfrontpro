import { Lobby, PlayerTeams } from '../types';

export function getPlayerTeams(lobby: Lobby): PlayerTeams | null {
  // All lobbies now use the standardized teams field with PlayerTeams type
  const teams = lobby.teams;
  if (teams === null || teams === undefined) return { group: 'FFA' };
  return teams;
}

export function formatPlayerTeams(pt: PlayerTeams): string {
  switch (pt.group) {
    case 'FFA':     return 'FFA';
    case 'Teams':   return `${pt.num_teams} Teams`;
    case 'Parties': return `Parties (${pt.party_size})`;
  }
}
