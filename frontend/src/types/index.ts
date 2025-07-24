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
