import { Lobby, GameStatus } from '../types';

// Helper function to determine game status
export const getGameStatus = (lobby: Lobby, index: number): GameStatus => {
  if (lobby.analysis_complete) return 'analyzed';
  if (lobby.completed) return 'completed';
  return 'in-progress';
};

// Helper function to format timestamp
export const formatTimestamp = (unixSec: number): string => {
  return new Date(unixSec * 1000).toLocaleString();
};

// Helper function to get time ago
export const getTimeAgo = (unixSec: number): string => {
  const now = Date.now() / 1000;
  const diff = now - unixSec;
  
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Helper function to format ISO date string
export const formatISODate = (isoString: string): string => {
  return new Date(isoString).toLocaleString();
};

// Helper function to get time ago from ISO string
export const getTimeAgoFromISO = (isoString: string): string => {
  const timestamp = new Date(isoString).getTime() / 1000;
  return getTimeAgo(timestamp);
};

// Helper function to calculate total games played
export const calculateTotalGames = (stats: any): number => {
  let total = 0;
  if (stats && stats.Public) {
    Object.values(stats.Public).forEach((modes: any) => {
      Object.values(modes).forEach((difficultyStats: any) => {
        if (difficultyStats.total) {
          total += parseInt(difficultyStats.total, 10) || 0;
        }
      });
    });
  }
  return total;
};

// Helper function to calculate win rate
export const calculateWinRate = (stats: any): number => {
  let totalWins = 0;
  let totalGames = 0;
  
  if (stats && stats.Public) {
    Object.values(stats.Public).forEach((modes: any) => {
      Object.values(modes).forEach((difficultyStats: any) => {
        if (difficultyStats.wins && difficultyStats.total) {
          totalWins += parseInt(difficultyStats.wins, 10) || 0;
          totalGames += parseInt(difficultyStats.total, 10) || 0;
        }
      });
    });
  }
  
  return totalGames > 0 ? totalWins / totalGames : 0;
};

// Helper function to calculate total losses
export const calculateTotalLosses = (stats: any): number => {
  let totalLosses = 0;
  
  if (stats && stats.Public) {
    Object.values(stats.Public).forEach((modes: any) => {
      Object.values(modes).forEach((difficultyStats: any) => {
        if (difficultyStats.losses) {
          totalLosses += parseInt(difficultyStats.losses, 10) || 0;
        }
      });
    });
  }
  
  return totalLosses;
};

// Helper function to calculate total wins
export const calculateTotalWins = (stats: any): number => {
  let totalWins = 0;
  
  if (stats && stats.Public) {
    Object.values(stats.Public).forEach((modes: any) => {
      Object.values(modes).forEach((difficultyStats: any) => {
        if (difficultyStats.wins) {
          totalWins += parseInt(difficultyStats.wins, 10) || 0;
        }
      });
    });
  }
  
  return totalWins;
};

// Re-export chart utilities
export * from './charts';

// Re-export player utilities
export * from './players';
