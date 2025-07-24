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

// Re-export chart utilities
export * from './charts';
