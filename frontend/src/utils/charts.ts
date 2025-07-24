// Chart utilities for processing and formatting game analysis data

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

export interface GamePlayer {
  id: string;
  client_id?: string;
  small_id: number;
  player_type: string;
  name: string;
  flag?: string;
  team?: number;
  spawn_info?: {
    tick: number;
    x: number;
    y: number;
    previous_spawns: any;
  };
}

// Generate a consistent color for each player
export const getPlayerColor = (playerIndex: number): string => {
  const colors = [
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
  
  return colors[playerIndex % colors.length];
};

// Convert player stats data into D3-friendly format
export const formatPlayerStatsForChart = (
  statsData: PlayerStatsOverGame,
  metric: 'troops' | 'gold' | 'workers' | 'tiles_owned'
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

  // Format data for each player
  const playerLines = Array.from(allPlayers.entries()).map(([clientId, name], index) => ({
    id: clientId,
    name,
    color: getPlayerColor(index),
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
export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};
