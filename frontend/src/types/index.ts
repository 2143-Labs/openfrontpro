// Types for lobby data

// New structured player teams type modeling the backend enum
export type PlayerTeams =
  | { group: 'FFA' }
  | { group: 'Teams'; num_teams: number }
  | { group: 'Parties'; party_size: number };


export interface Lobby {
  game_id: string;
  teams: PlayerTeams;
  max_players: number;
  game_map: string;
  approx_num_players: number;
  first_seen_unix_sec: number;
  last_seen_unix_sec: number;
  completed: boolean;
  analysis_complete: boolean;
}

export type SortBy = 'last_seen' | 'players' | 'map';

export type GameStatus = 'completed' | 'full' | 'active' | 'in-progress';
