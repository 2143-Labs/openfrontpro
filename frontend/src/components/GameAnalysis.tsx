import React, { useState, useEffect } from 'react';
import LineChart from './LineChart';
import ConstructionEventLog from './ConstructionEventLog';
import EventLog from './EventLog';
import { 
  formatPlayerStatsForChart, 
  calculateGameSummary,
  formatEventsForTimeline,
  filterStatsByDuration,
  tickToTime,
  formatNumber,
  PlayerStatsOverGame,
  GeneralEvent,
  DisplayEvent,
  GamePlayer,
  DurationFilter,
  createPlayerColorMap,
  getPlayerColorById,
  PlayerColorMap
} from '../utils/charts';
import { ConstructionEvent } from '../types';
import { fetchConstructionEvents } from '../services/api';
import { getPlayerTypeLabel, humansOnly } from '../utils/players';

interface GameAnalysisProps {
  gameId: string;
  players?: GamePlayer[];   // new optional prop
}

const GameAnalysis: React.FC<GameAnalysisProps> = ({ gameId, players: propPlayers }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsData, setStatsData] = useState<PlayerStatsOverGame | null>(null);
  const [generalEvents, setGeneralEvents] = useState<GeneralEvent[]>([]);
  const [displayEvents, setDisplayEvents] = useState<DisplayEvent[]>([]);
  const [constructionEvents, setConstructionEvents] = useState<ConstructionEvent[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'troops' | 'gold' | 'workers' | 'tiles_owned'>('tiles_owned');
  const [selectedDuration, setSelectedDuration] = useState<DurationFilter>('all');
  const [colorMap, setColorMap] = useState<PlayerColorMap>(new Map());

  const durationOptions = [
    {label: '1 m', value: 1},
    {label: '3 m', value: 3},
    {label: '10 m', value: 10},
    {label: '30 m', value: 30},
    {label: 'All', value: 'all'}
  ];

  useEffect(() => {
    fetchAnalysisData();
  }, [gameId]);

  const fetchAnalysisData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch analysis data - conditionally fetch players if not provided as prop
      const requests = [
        fetch(`/api/v1/analysis/${gameId}/get_player_stats`),
        fetch(`/api/v1/analysis/${gameId}/get_general_events`),
        fetch(`/api/v1/analysis/${gameId}/get_display_events`)
      ];
      
      if (!propPlayers) {
        requests.push(fetch(`/api/v1/analysis/${gameId}/players`));
      }
      
      const responses = await Promise.all(requests);
      const [statsResponse, generalEventsResponse, displayEventsResponse, playersResponse] = responses;

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch player stats: ${statsResponse.status}`);
      }
      if (!generalEventsResponse.ok) {
        throw new Error(`Failed to fetch general events: ${generalEventsResponse.status}`);
      }
      if (!displayEventsResponse.ok) {
        throw new Error(`Failed to fetch display events: ${displayEventsResponse.status}`);
      }
      if (!propPlayers && playersResponse && !playersResponse.ok) {
        throw new Error(`Failed to fetch players: ${playersResponse.status}`);
      }

      const jsonPromises = [
        statsResponse.json(),
        generalEventsResponse.json(),
        displayEventsResponse.json()
      ];
      
      if (!propPlayers && playersResponse) {
        jsonPromises.push(playersResponse.json());
      }
      
      const jsonResults = await Promise.all(jsonPromises);
      const [stats, generalEventsData, displayEventsData, playersData] = jsonResults;

      setStatsData(stats);
      setGeneralEvents(generalEventsData.events || []);
      setDisplayEvents(displayEventsData.events || []);
      
      // Use prop players if provided, otherwise use fetched players
      // Always filter out bots regardless of source
      const filteredPlayers = propPlayers ? humansOnly(propPlayers) : humansOnly(playersData?.players || []);
      setPlayers(filteredPlayers);
      
      // Create consistent color mapping for all components
      const newColorMap = createPlayerColorMap(filteredPlayers);
      setColorMap(newColorMap);

      // Fetch construction events separately (to avoid blocking if this endpoint fails)
      try {
        const constructionResponse = await fetchConstructionEvents(gameId);
        setConstructionEvents(constructionResponse.events || []);
      } catch (constructionError) {
        console.warn('Failed to fetch construction events:', constructionError);
        setConstructionEvents([]); // Set empty array on failure but don't fail the whole component
      }

    } catch (err) {
      console.error('Error fetching analysis data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analysis data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading game analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
        <p>Error: {error}</p>
        <button 
          onClick={fetchAnalysisData}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!statsData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>No analysis data available for this game.</p>
      </div>
    );
  }

  const effectiveStats = filterStatsByDuration(statsData, selectedDuration);
  
  // Filter construction events by the same duration filter
  const filterConstructionEventsByDuration = (events: ConstructionEvent[], duration: DurationFilter) => {
    if (duration === 'all') return events;
    
    // Get min tick from stats data to establish game start time
    const ticks = Object.keys(statsData.player_stats_ticks).map(Number);
    if (ticks.length === 0) return events;
    
    const minTick = Math.min(...ticks);
    const threshold = minTick + duration * 60 * 10; // 10 ticks per second
    
    return events.filter(event => event.tick <= threshold);
  };
  
  const filteredConstructionEvents = filterConstructionEventsByDuration(constructionEvents, selectedDuration);

  const chartData = formatPlayerStatsForChart(effectiveStats, selectedMetric, colorMap);
  const summary = calculateGameSummary(statsData, players);
  const events = formatEventsForTimeline(generalEvents, displayEvents);

  const metricLabels = {
    troops: 'Troops',
    gold: 'Gold',
    workers: 'Workers',
    tiles_owned: 'Tiles Owned'
  };

  return (
    <div className="game-analysis" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Game Analysis</h2>
        <button 
          onClick={fetchAnalysisData}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🔄 Refresh Data
        </button>
      </div>

      {/* Game Summary */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '15px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px'
      }}>
        <div>
          <h4 style={{ margin: '0 0 5px 0', color: '#495057' }}>Game Duration</h4>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            {tickToTime(summary.gameDuration)}
          </p>
        </div>
        <div>
          <h4 style={{ margin: '0 0 5px 0', color: '#495057' }}>Players</h4>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            {summary.activePlayers}/{summary.totalPlayers}
          </p>
        </div>
        {summary.leaders.troops && (
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: '#495057' }}>Troop Leader</h4>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              {summary.leaders.troops.name} ({formatNumber(summary.leaders.troops.troops)})
            </p>
          </div>
        )}
        {summary.leaders.gold && (
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: '#495057' }}>Gold Leader</h4>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              {summary.leaders.gold.name} ({formatNumber(summary.leaders.gold.gold)})
            </p>
          </div>
        )}
      </div>

{/* Duration Selector */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {durationOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedDuration(opt.value as any)}
            style={{
              padding: '8px 16px',
              border: selectedDuration === opt.value ? '2px solid #007bff' : '1px solid #ccc',
              backgroundColor: selectedDuration === opt.value ? '#007bff' : 'white',
              color: selectedDuration === opt.value ? 'white' : '#333',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Metric Selector */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {Object.entries(metricLabels).map(([metric, label]) => (
          <button
            key={metric}
            onClick={() => setSelectedMetric(metric as any)}
            style={{
              padding: '8px 16px',
              border: selectedMetric === metric ? '2px solid #007bff' : '1px solid #ccc',
              backgroundColor: selectedMetric === metric ? '#007bff' : 'white',
              color: selectedMetric === metric ? 'white' : '#333',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Chart */}
      <div style={{ marginBottom: '30px' }}>
        <LineChart
          data={chartData}
          title={`${metricLabels[selectedMetric]} Over Time`}
          yAxisLabel={metricLabels[selectedMetric]}
          width={Math.min(900, window.innerWidth - 60)}
          height={400}
          constructionEvents={filteredConstructionEvents}
        />
      </div>

      {/* Player List */}
      <div style={{ marginBottom: '30px' }}>
        <h3>Players</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '15px' 
        }}>
          {players.map((player, index) => (
            <div 
              key={player.id}
              style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '1px solid #dee2e6'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <div 
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: player.client_id ? getPlayerColorById(colorMap, player.client_id) : '#cccccc',
                    borderRadius: '50%',
                    marginRight: '8px'
                  }}
                />
                <h4 style={{ margin: 0, fontSize: '16px' }}>{player.name}</h4>
              </div>
              <div style={{ fontSize: '14px', color: '#6c757d' }}>
                <div><strong>Type:</strong> {getPlayerTypeLabel(player.player_type)}</div>
                {player.team !== null && player.team !== undefined && (
                  <div><strong>Team:</strong> {player.team}</div>
                )}
                {player.spawn_info && (
                  <div>
                    <strong>Spawn:</strong> ({player.spawn_info.x}, {player.spawn_info.y}) 
                    at {tickToTime(player.spawn_info.tick)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Construction Event Log */}
      <div style={{ marginBottom: '30px' }}>
        <h3>Construction Event Log</h3>
        <ConstructionEventLog
          events={constructionEvents}
          players={players}
          mapWidth={2000}  // Default World map dimensions
          mapHeight={1000}
          statsData={statsData}
          colorMap={colorMap}
        />
      </div>

      {/* Events */}
      <div>
        <h3>Events</h3>
        <EventLog
          events={events}
          players={players}
          colorMap={colorMap}
          height={400}
        />
      </div>
    </div>
  );
};

export default GameAnalysis;
