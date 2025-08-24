import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GamePlayer, createPlayerColorMap, getPlayerColorById, tickToTime } from '../utils/charts';
import { showTooltip, moveTooltip, hideTooltip } from '../utils/tooltip';

// Construction event type matching backend API
interface ConstructionEvent {
  tick: number;
  unit_type: string;
  x: number;
  y: number;
  level: number;
  small_id: number;
  client_id?: string;
  name: string;
}

interface ConstructionEventsResponse {
  events: ConstructionEvent[];
}

interface MapOverTimeProps {
  gameId: string;
  players?: GamePlayer[] | null;
  mapWidth: number;
  mapHeight: number;
  maxRenderWidth?: number;
}

// Unit type to icon mapping
const getUnitIcon = (unitType: string): string => {
  const unitIcons: Record<string, string> = {
    'city': '🏙️',
    'port': '⚓',
    'factory': '🏭',
    'defp': '🛡️',
    'silo': '🚀',
    'saml': '🎯',
    'wshp': '🚢',
  };
  return unitIcons[unitType.toLowerCase()] || '🏗️';
};

// Unit type to size mapping for visual hierarchy
const getUnitSize = (unitType: string): number => {
  const unitSizes: Record<string, number> = {
    'city': 8,
    'port': 6,
    'factory': 6,
    'defp': 4,
    'silo': 5,
    'saml': 4,
    'wshp': 6,
  };
  return unitSizes[unitType.toLowerCase()] || 4;
};

// Helper to format unit type name with proper capitalization
const formatUnitTypeName = (unitType: string): string => {
  const unitNames: Record<string, string> = {
    'city': 'City',
    'port': 'Port',
    'factory': 'Factory',
    'defp': 'Defense',
    'silo': 'Missile Silo',
    'saml': 'SAM Launcher',
    'wshp': 'Warship',
  };
  return unitNames[unitType.toLowerCase()] || unitType.charAt(0).toUpperCase() + unitType.slice(1);
};

// Build HTML content for construction event tooltip
const buildTooltipHTML = (event: ConstructionEvent, playerColor: string): string => {
  const icon = getUnitIcon(event.unit_type);
  const unitName = formatUnitTypeName(event.unit_type);
  const levelText = event.level > 1 ? ` (L${event.level})` : '';
  const formattedTime = tickToTime(event.tick);
  
  return `
    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
      <span style="font-size: 18px;">${icon}</span>
      <strong>${unitName}${levelText}</strong>
    </div>
    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${playerColor};"></span>
      <span>${event.name}</span>
    </div>
    <div style="font-size: 11px; color: #ccc;">
      Tick ${event.tick} • ${formattedTime}
    </div>
  `;
};

const MapOverTime: React.FC<MapOverTimeProps> = ({ 
  gameId, 
  players, 
  mapWidth, 
  mapHeight, 
  maxRenderWidth = 600 
}) => {
  const [constructionEvents, setConstructionEvents] = useState<ConstructionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTick, setCurrentTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1); // multiplier for play speed

  // Calculate render dimensions maintaining aspect ratio
  const renderWidth = Math.min(maxRenderWidth, mapWidth);
  const renderHeight = (renderWidth / mapWidth) * mapHeight;
  const scaleX = renderWidth / mapWidth;
  const scaleY = renderHeight / mapHeight;

  // Create player color mapping
  const playerColorMap = useMemo(() => 
    players ? createPlayerColorMap(players) : new Map(), 
    [players]
  );

  // Fetch construction events
  useEffect(() => {
    const fetchConstructionEvents = async () => {
      if (!gameId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/v1/analysis/${gameId}/get_construction_events`);
        if (!response.ok) {
          throw new Error(`Failed to fetch construction events: ${response.status}`);
        }
        
        const data: ConstructionEventsResponse = await response.json();
        setConstructionEvents(data.events || []);
        
        // Set initial tick to first event or 0
        if (data.events && data.events.length > 0) {
          setCurrentTick(data.events[0].tick);
        }
      } catch (err) {
        console.error('Error fetching construction events:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch construction events');
      } finally {
        setLoading(false);
      }
    };

    fetchConstructionEvents();
  }, [gameId]);

  // Get tick range
  const { minTick, maxTick } = useMemo(() => {
    if (constructionEvents.length === 0) return { minTick: 0, maxTick: 0 };
    
    const ticks = constructionEvents.map(e => e.tick);
    return {
      minTick: Math.min(...ticks),
      maxTick: Math.max(...ticks)
    };
  }, [constructionEvents]);

  // Filter events up to current tick
  const visibleEvents = useMemo(() => {
    return constructionEvents.filter(event => event.tick <= currentTick);
  }, [constructionEvents, currentTick]);

  // Hide tooltip when timeline advances
  useEffect(() => {
    hideTooltip();
  }, [currentTick]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || maxTick === 0) return;

    const interval = setInterval(() => {
      setCurrentTick(prev => {
        if (prev >= maxTick) {
          setIsPlaying(false);
          return maxTick;
        }
        // Step by roughly 10 ticks per interval, adjusted by speed
        const step = Math.max(1, Math.floor(10 * playSpeed));
        return Math.min(prev + step, maxTick);
      });
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [isPlaying, maxTick, playSpeed]);

  const handleTickChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTick(parseInt(event.target.value));
  }, []);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const resetToStart = useCallback(() => {
    setCurrentTick(minTick);
    setIsPlaying(false);
  }, [minTick]);

  if (loading) {
    return (
      <div style={{ 
        width: renderWidth, 
        height: renderHeight + 80,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa'
      }}>
        <p>Loading construction timeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        width: renderWidth, 
        height: renderHeight + 80,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa'
      }}>
        <p style={{ color: '#dc3545' }}>Error: {error}</p>
      </div>
    );
  }

  if (constructionEvents.length === 0) {
    return (
      <div style={{ 
        width: renderWidth, 
        height: renderHeight + 80,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa'
      }}>
        <p>No construction events found for this game.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      width: renderWidth,
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: 'white',
      padding: '10px'
    }}>
      {/* Map SVG */}
      <div style={{ position: 'relative', marginBottom: '15px' }}>
        <svg 
          width={renderWidth} 
          height={renderHeight}
          style={{ 
            border: '1px solid #ccc',
            backgroundColor: '#e8f4f8',
            borderRadius: '4px'
          }}
        >
          {/* Render construction events */}
          {visibleEvents.map((event, index) => {
            const playerColor = event.client_id 
              ? getPlayerColorById(playerColorMap, event.client_id)
              : '#888888';
            
            const x = event.x * scaleX;
            const y = event.y * scaleY;
            const size = getUnitSize(event.unit_type);
            const icon = getUnitIcon(event.unit_type);
            
            return (
              <g 
                key={`${event.tick}-${index}`}
                onMouseEnter={(e) => showTooltip(buildTooltipHTML(event, playerColor), e.nativeEvent)}
                onMouseMove={(e) => moveTooltip(e.nativeEvent)}
                onMouseLeave={hideTooltip}
                style={{ cursor: 'pointer' }}
              >
                {/* Building dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={size}
                  fill={playerColor}
                  stroke="white"
                  strokeWidth={1}
                  opacity={0.8}
                />
                
                {/* Unit type emoji icon */}
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.max(size * 0.6, 6)}
                  pointerEvents="none"
                  style={{ userSelect: 'none' }}
                >
                  {icon}
                </text>
              </g>
            );
          })}
        </svg>
        
        {/* Current time overlay */}
        <div style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          Tick {currentTick} ({tickToTime(currentTick)})
        </div>
        
        {/* Event counter */}
        <div style={{
          position: 'absolute',
          top: '5px',
          left: '5px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          {visibleEvents.length} structures
        </div>
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '10px' }}>
        {/* Play controls */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          marginBottom: '10px'
        }}>
          <button
            onClick={resetToStart}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            disabled={isPlaying}
          >
            ⏮️ Reset
          </button>
          
          <button
            onClick={togglePlayPause}
            style={{
              padding: '4px 12px',
              border: '1px solid #007bff',
              borderRadius: '4px',
              backgroundColor: isPlaying ? '#dc3545' : '#007bff',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </button>
          
          <select
            value={playSpeed}
            onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
            style={{
              padding: '4px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px'
            }}
            disabled={isPlaying}
          >
            <option value={0.5}>0.5x Speed</option>
            <option value={1}>1x Speed</option>
            <option value={2}>2x Speed</option>
            <option value={5}>5x Speed</option>
          </select>
        </div>
        
        {/* Tick slider */}
        <div>
          <input
            type="range"
            min={minTick}
            max={maxTick}
            value={currentTick}
            onChange={handleTickChange}
            style={{
              width: '100%',
              marginBottom: '5px'
            }}
            disabled={isPlaying}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#666'
          }}>
            <span>Start: {tickToTime(minTick)}</span>
            <span>End: {tickToTime(maxTick)}</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ 
        fontSize: '11px',
        color: '#666',
        borderTop: '1px solid #eee',
        paddingTop: '8px'
      }}>
        <div><strong>Units:</strong> City (8px), Port/Factory/Warship (6px), Silo (5px), Defense/SAM (4px)</div>
        {players && players.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            <strong>Players:</strong> {' '}
            {players.slice(0, 6).map((player, idx) => (
              <span key={player.client_id || idx} style={{ marginRight: '8px' }}>
                <span 
                  style={{ 
                    display: 'inline-block', 
                    width: '10px', 
                    height: '10px', 
                    backgroundColor: getPlayerColorById(playerColorMap, player.client_id || ''),
                    borderRadius: '50%',
                    marginRight: '3px'
                  }} 
                />
                {player.name}
              </span>
            ))}
            {players.length > 6 && <span>... +{players.length - 6} more</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapOverTime;
