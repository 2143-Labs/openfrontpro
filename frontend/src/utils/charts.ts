// Chart utilities for processing and formatting game analysis data
import { GamePlayer } from '../types';

// Duration filter type - 'all' for no filtering, or number of minutes
export type DurationFilter = 'all' | 1 | 3 | 10 | 30;

export interface PlayerStatsOnTick {
  client_id?: string;
  name: string;
  tiles_owned: number;
  gold: number;
  workers: number;
  troops: number;
}

export interface PlayerStatsOverGame {
  player_stats_ticks: Record<number, PlayerStatsOnTick[]>;
}

export interface GeneralEvent {
  tick: number;
  event_type: string;
  data: any;
}

export interface DisplayEvent {
  tick: number;
  message_type: string;
  message: string;
  player_id: number;
  gold_amount?: number;
}

// Event type from formatEventsForTimeline utility
export interface TimelineEvent {
  tick: number;
  type: 'general' | 'display';
  category: string;
  message: string;
  playerId?: number;
  goldAmount?: number;
  data?: any;
}

// Type for consistent color mapping across components
export type PlayerColorMap = Map<string, string>;

// Color palette for players
const PLAYER_COLORS = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // cyan
  '#ff9896', // light red
  '#98df8a', // light green
  '#c5b0d5', // light purple
  '#f7b6d3', // light pink
  '#c7c7c7', // light gray
  '#dbdb8d', // light olive
  '#9edae5', // light cyan
];

// Generate a consistent color for each player by index
export const getPlayerColor = (playerIndex: number): string => {
  return PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
};

// Create a consistent color mapping for a list of players
// This ensures the same player always gets the same color across components
export const createPlayerColorMap = (players: GamePlayer[]): Map<string, string> => {
  const colorMap = new Map<string, string>();
  
  // Sort players by client_id to ensure consistent ordering
  const sortedPlayers = players
    .filter(player => player.client_id) // Only players with client_id
    .sort((a, b) => (a.client_id || '').localeCompare(b.client_id || ''));
  
  sortedPlayers.forEach((player, index) => {
    if (player.client_id) {
      colorMap.set(player.client_id, getPlayerColor(index));
    }
  });
  
  return colorMap;
};

// Get consistent color for a player by client_id using a color map
export const getPlayerColorById = (colorMap: Map<string, string>, clientId: string): string => {
  return colorMap.get(clientId) || '#cccccc'; // fallback gray
};

// Convert player stats data into D3-friendly format
// Now accepts colorMap parameter to ensure consistent coloring
export const formatPlayerStatsForChart = (
  statsData: PlayerStatsOverGame,
  metric: 'troops' | 'gold' | 'workers' | 'tiles_owned',
  colorMap: Map<string, string>
) => {
  const ticks = Object.keys(statsData.player_stats_ticks)
    .map(Number)
    .sort((a, b) => a - b);

  // Get all unique players
  const allPlayers = new Map<string, string>(); // client_id -> name
  Object.values(statsData.player_stats_ticks).forEach(tickData => {
    tickData.forEach(player => {
      if (player.client_id) {
        allPlayers.set(player.client_id, player.name);
      }
    });
  });

  // Format data for each player using consistent color mapping
  const playerLines = Array.from(allPlayers.entries()).map(([clientId, name]) => ({
    id: clientId,
    name,
    color: getPlayerColorById(colorMap, clientId),
    data: ticks.map(tick => {
      const tickData = statsData.player_stats_ticks[tick];
      const playerData = tickData?.find(p => p.client_id === clientId);
      return {
        tick,
        value: playerData ? playerData[metric] : 0,
      };
    }).filter(d => d.value > 0 || ticks.indexOf(d.tick) === 0), // Keep first point even if 0
  }));

  return playerLines;
};

// Format events for timeline display
export const formatEventsForTimeline = (
  generalEvents: GeneralEvent[],
  displayEvents: DisplayEvent[]
) => {
  const events = [
    ...generalEvents.map(event => ({
      tick: event.tick,
      type: 'general' as const,
      category: event.event_type,
      message: `${event.event_type}: ${JSON.stringify(event.data)}`,
      data: event.data,
    })),
    ...displayEvents.map(event => ({
      tick: event.tick,
      type: 'display' as const,
      category: event.message_type,
      message: event.message,
      playerId: event.player_id,
      goldAmount: event.gold_amount,
    })),
  ];

  return events.sort((a, b) => a.tick - b.tick);
};

// Calculate game summary statistics
export const calculateGameSummary = (
  statsData: PlayerStatsOverGame,
  players: GamePlayer[]
) => {
  const ticks = Object.keys(statsData.player_stats_ticks).map(Number).sort((a, b) => a - b);
  const maxTick = Math.max(...ticks);
  const finalTick = statsData.player_stats_ticks[maxTick] || [];

  const totalPlayers = players.length;
  const activePlayers = finalTick.length;
  const gameDuration = maxTick; // in ticks

  // Find leading player in each category
  const leaders = {
    troops: finalTick.reduce((max, player) => player.troops > max.troops ? player : max, finalTick[0]),
    gold: finalTick.reduce((max, player) => player.gold > max.gold ? player : max, finalTick[0]),
    tiles: finalTick.reduce((max, player) => player.tiles_owned > max.tiles_owned ? player : max, finalTick[0]),
  };

  return {
    totalPlayers,
    activePlayers,
    gameDuration,
    leaders,
    finalTick: maxTick,
  };
};

// Filter stats data by duration (first N minutes)
export const filterStatsByDuration = (
  statsData: PlayerStatsOverGame,
  duration: DurationFilter
): PlayerStatsOverGame => {
  // If duration is 'all', return the original object
  if (duration === 'all') {
    return statsData;
  }

  // Determine minTick (smallest key)
  const ticks = Object.keys(statsData.player_stats_ticks).map(Number);
  if (ticks.length === 0) {
    return statsData;
  }
  
  const minTick = Math.min(...ticks);
  
  // Compute threshold = minTick + duration * 60 * 10 (10 ticks ≈ 1 s)
  const threshold = minTick + duration * 60 * 10;
  
  // Build and return a shallow-copy object where player_stats_ticks
  // only contains entries whose numeric key <= threshold
  const filteredPlayerStatsTicks: Record<number, PlayerStatsOnTick[]> = {};
  
  for (const [tickStr, playerStats] of Object.entries(statsData.player_stats_ticks)) {
    const tickNum = Number(tickStr);
    if (tickNum <= threshold) {
      filteredPlayerStatsTicks[tickNum] = playerStats;
    }
  }
  
  return {
    ...statsData,
    player_stats_ticks: filteredPlayerStatsTicks,
  };
};

// Convert tick to time (assuming 10 ticks per second)
export const tickToTime = (tick: number): string => {
  const seconds = Math.floor(tick / 10);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
};

// Format large numbers with units
export const truncate = (str: string, maxLen: number = 120): string => {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

// Get all players sorted by a specific metric - assumes caller passes pre-filtered list
export const getAllPlayers = (players: any[], metric: string) => {
  return players
    .filter(p => p.stats && p.stats[metric])
    .sort((a, b) => {
      const aValue = Array.isArray(a.stats[metric]) ? parseInt(a.stats[metric][0]) : parseInt(a.stats[metric]);
      const bValue = Array.isArray(b.stats[metric]) ? parseInt(b.stats[metric][0]) : parseInt(b.stats[metric]);
      return bValue - aValue;
    });
};

// Convert unit type to human-readable display name
export const unitTypeDisplay = (unit_type: string): string => {
  const unitTypeMap: Record<string, string> = {
    'city': 'City',
    'City': 'City',
    'factory': 'Factory',
    'Factory': 'Factory',
    'port': 'Port',
    'Port': 'Port',
    'defp': 'Defense Post',
    'Defense Post': 'Defense Post',
    'silo': 'Missile Silo',
    'Missile Silo': 'Missile Silo',
    'saml': 'SAM Launcher',
    'SAM Launcher': 'SAM Launcher',
    'wshp': 'Warship',
    'Warship': 'Warship',
  };
  
  return unitTypeMap[unit_type] || unit_type;
};

// Get player by client_id
export const getPlayerById = (players: GamePlayer[], clientId: string): GamePlayer | undefined => {
  return players.find(player => player.client_id === clientId || player.id === clientId);
};

// Round to the nearest valid construction cost based on 125k * 2^k formula
const roundToNearestConstructionCost = (rawCost: number): number => {
  if (rawCost <= 0) {
    return 0; // Will be handled as "Captured" later
  }

  // Base cost is 125k (125,000)
  const baseCost = 125000;
  
  // Find the closest multiple of baseCost * 2^k
  let bestCost = baseCost;
  let bestDifference = Math.abs(rawCost - bestCost);
  
  // Check up to 2^10 (about 128M, which should cover all reasonable costs)
  for (let k = 1; k <= 10; k++) {
    const cost = baseCost * Math.pow(2, k);
    const difference = Math.abs(rawCost - cost);
    
    if (difference < bestDifference) {
      bestCost = cost;
      bestDifference = difference;
    }
    
    // If we're getting farther away, we can stop
    if (difference > bestDifference * 2) {
      break;
    }
  }
  
  return bestCost;
};

// Calculate construction cost by finding gold difference before and after the event
export const calculateConstructionCost = (
  constructionTick: number,
  clientId: string,
  statsData: PlayerStatsOverGame | null
): number | null => {
  if (!statsData || !statsData.player_stats_ticks) {
    return null;
  }

  // Get all ticks and sort them
  const allTicks = Object.keys(statsData.player_stats_ticks)
    .map(Number)
    .sort((a, b) => a - b);

  // Find the tick right before the construction
  const beforeTick = allTicks
    .filter(tick => tick < constructionTick)
    .pop(); // Get the latest tick before construction

  // Find the tick right after the construction (could be the construction tick itself or later)
  const afterTick = allTicks
    .find(tick => tick >= constructionTick);

  if (beforeTick === undefined || !afterTick) {
    return null; // Can't calculate if we don't have before/after data
  }

  // Get player stats for before and after ticks
  const beforeStats = statsData.player_stats_ticks[beforeTick];
  const afterStats = statsData.player_stats_ticks[afterTick];

  if (!beforeStats || !afterStats) {
    return null;
  }

  // Find the specific player in both tick data
  const playerBefore = beforeStats.find(p => p.client_id === clientId);
  const playerAfter = afterStats.find(p => p.client_id === clientId);

  if (!playerBefore || !playerAfter) {
    return null; // Player not found in stats
  }

  // Calculate the raw gold difference (cost is the decrease in gold)
  const rawGoldDifference = playerBefore.gold - playerAfter.gold;
  
  // Round to the nearest valid construction cost
  return roundToNearestConstructionCost(rawGoldDifference);
};
