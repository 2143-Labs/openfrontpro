import { useState, useEffect } from 'react';
import { Lobby, SortBy } from '../types';
import { fetchLobbies } from '../services/api';
import { getPlayerTeams, formatPlayerTeams } from '../utils/teams';

export const useLobbies = () => {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedFilter, setCompletedFilter] = useState<boolean | null>(null);
  const [hasAnalysisFilter, setHasAnalysisFilter] = useState<boolean | null>(null);
  const [afterFilter, setAfterFilter] = useState<number | null>(null);
  const [mapFilter, setMapFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortBy>('last_seen');

  const loadLobbies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await fetchLobbies({
        completed: completedFilter,
        hasAnalysis: hasAnalysisFilter,
        after: afterFilter,
        mapName: mapFilter
      });
      
      setLobbies(data);
    } catch (err) {
      console.error('Error fetching lobbies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch lobbies');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort lobbies
  const getFilteredAndSortedLobbies = () => {
    let filtered = lobbies;
    
    // Filter by team type if selected
    if (teamFilter) {
      filtered = filtered.filter(lobby => {
        const playerTeams = getPlayerTeams(lobby);
        return playerTeams ? formatPlayerTeams(playerTeams) === teamFilter : false;
      });
    }
    
    // Sort lobbies
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'last_seen':
          return b.last_seen_unix_sec - a.last_seen_unix_sec;
        case 'players':
          return b.approx_num_players - a.approx_num_players;
        case 'map':
          return a.game_map.localeCompare(b.game_map);
        default:
          return 0;
      }
    });
    
    return sorted;
  };

  // Fetch lobbies on component mount and when filters change
  useEffect(() => {
    loadLobbies();
  }, [completedFilter, hasAnalysisFilter, afterFilter, mapFilter, teamFilter]);

  return {
    lobbies,
    loading,
    error,
    completedFilter,
    setCompletedFilter,
    hasAnalysisFilter,
    setHasAnalysisFilter,
    afterFilter,
    setAfterFilter,
    mapFilter,
    setMapFilter,
    teamFilter,
    setTeamFilter,
    sortBy,
    setSortBy,
    getFilteredAndSortedLobbies,
    refreshLobbies: loadLobbies
  };
};
