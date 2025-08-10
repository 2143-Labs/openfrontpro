// Types for lobby data

// New structured player teams type modeling the backend enum
export type PlayerTeams =
  | { group: 'FFA' }
  | { group: 'Teams'; num_teams: number }
  | { group: 'Parties'; party_size: number };


export interface QueueItem {
  game_id: string;
  status: string;
  queued_for_sec: number; // seconds - note the API uses queued_for_sec
  started_at_unix_sec?: number | null;
}

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
  domain?: string;
  subdomain?: string;
  version?: string;
  gitCommit?: string;
  info?: {
    config?: {
      bots: number;
      difficulty: string;
      disableNPCs: boolean;
      disabledUnits: string[];
      gameMap: string;
      gameMode: string;
      gameType: string;
      infiniteGold: boolean;
      infiniteTroops: boolean;
      instantBuild: boolean;
      maxPlayers: number;
      playerTeams: number;
    };
    duration: number;
    end: number;
    num_turns: number;
    players: Array<{
      clientID: string;
      player_type?: string;
      stats?: {
        attacks?: string[];
        betrayals?: string;
        boats?: {
          trade?: string[];
          trans?: string[];
        };
        bombs?: {
          abomb?: string[];
          hbomb?: string[];
        };
        gold?: string[];
        units?: {
          city?: string[];
          defp?: string[];
          port?: string[];
          silo?: string[];
          wshp?: string[];
          saml?: string[];
        };
      };
      username: string;
    }>;
    start: number;
    winner: string[];
  };
}

export type SortBy = 'last_seen' | 'players' | 'map';

export type GameStatus = 'completed' | 'analyzed' | 'in-progress';

// User-related types
export interface OpenFrontGame {
  clientId: string;
  difficulty: string;
  gameId: string;
  map: string;
  mode: string;
  start: string;
  type: string;
}

export interface UserGameStats {
  attacks?: string[];
  betrayals?: string;
  boats?: {
    trade?: string[];
    trans?: string[];
  };
  bombs?: {
    abomb?: string[];
    hbomb?: string[];
    mirv?: string[];
    mirvw?: string[];
  };
  gold?: string[];
  units?: {
    city?: string[];
    defp?: string[];
    port?: string[];
    saml?: string[];
    silo?: string[];
    wshp?: string[];
  };
}

export interface GameModeStats {
  losses: string;
  stats: UserGameStats;
  total: string;
  wins: string;
}

export interface OpenFrontPlayerData {
  createdAt: string;
  games: OpenFrontGame[];
  stats: {
    Public: {
      [mode: string]: {
        [difficulty: string]: GameModeStats;
      };
    };
  };
}

export interface RecentGame {
  game_id: string;
  client_id: string;
  name_in_that_game: string | null;
  flag_in_that_game: string | null;
  analysis_complete_time: number | null;
}

export interface UserSummary {
  user_id: string;
  username: string;
  is_tracked: boolean;
}

export type UsersResponse = { users: UserSummary[] };

export interface UserData {
  user_id: string;
  username: string;
  friends: string[];
  openfront_player_data: OpenFrontPlayerData;
  recent_games: RecentGame[];
}

// Legacy types for backwards compatibility
export interface UserGameSummary {
  game_id: string;
  map: string;
  mode: string;
  difficulty: string;
  start_time: number;
}
