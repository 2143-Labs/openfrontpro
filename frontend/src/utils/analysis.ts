import { AnalysisQueueEntry, RecentGame } from '../types';

export interface AnalysisStatus {
  state: 'completed' | 'queued' | 'none';
  statusText: string;
  badgeColor: {
    background: string;
    color: string;
  };
  queueStatus?: string;
}

/**
 * Determine the analysis status for a game based on the recent game data and analysis queue
 */
export const getAnalysisStatus = (
  gameId: string,
  recentGame: RecentGame,
  queue: AnalysisQueueEntry[]
): AnalysisStatus => {
  // Check if analysis is already completed
  if (recentGame.analysis_complete_time) {
    return {
      state: 'completed',
      statusText: 'Analyzed',
      badgeColor: {
        background: '#d4edda',
        color: '#155724'
      }
    };
  }

  // Check if game is in analysis queue
  const queueEntry = queue.find(entry => entry.game_id === gameId);
  if (queueEntry) {
    const status = queueEntry.status.toLowerCase();
    
    return {
      state: 'queued',
      statusText: queueEntry.status,
      queueStatus: queueEntry.status,
      badgeColor: getQueueStatusBadgeColor(status)
    };
  }

  // Game is neither completed nor queued
  return {
    state: 'none',
    statusText: 'Not queued',
    badgeColor: {
      background: '#f8f9fa',
      color: '#6c757d'
    }
  };
};

/**
 * Get badge colors for different queue status states
 */
export const getQueueStatusBadgeColor = (status: string): { background: string; color: string } => {
  switch (status) {
    case 'pending':
      return {
        background: '#fff3cd',
        color: '#856404'
      };
    case 'running':
      return {
        background: '#d1ecf1',
        color: '#0c5460'
      };
    case 'completed':
      return {
        background: '#d4edda',
        color: '#155724'
      };
    case 'failed':
    case 'stalled':
      return {
        background: '#f8d7da',
        color: '#721c24'
      };
    case 'notfound':
      return {
        background: '#e2e3e5',
        color: '#383d41'
      };
    case 'cancelled':
      return {
        background: '#ffeaa7',
        color: '#6c757d'
      };
    default:
      return {
        background: '#f8f9fa',
        color: '#6c757d'
      };
  }
};

/**
 * Format time duration from seconds to human readable format
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
