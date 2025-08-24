import React from 'react';
import { ConstructionEvent } from '../types';
import { GamePlayer, tickToTime, unitTypeDisplay, getPlayerById, getPlayerColor } from '../utils/charts';
import MiniMapSpot from './MiniMapSpot';

interface ConstructionEventLogProps {
  events: ConstructionEvent[];
  players: GamePlayer[];
  mapWidth: number;
  mapHeight: number;
}

const ConstructionEventLog: React.FC<ConstructionEventLogProps> = ({
  events,
  players,
  mapWidth,
  mapHeight,
}) => {
  // Sort events by tick ascending (chronological order)
  const sortedEvents = [...events].sort((a, b) => a.tick - b.tick);

  // Create a mapping of client_id to player color index for consistency
  const playerColorMap = new Map<string, number>();
  players.forEach((player, index) => {
    if (player.client_id) {
      playerColorMap.set(player.client_id, index);
    }
  });

  const getPlayerColor_ByClientId = (clientId: string): string => {
    const colorIndex = playerColorMap.get(clientId) ?? 0;
    return getPlayerColor(colorIndex);
  };

  if (sortedEvents.length === 0) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: '#6c757d',
        backgroundColor: 'white',
        border: '1px solid #dee2e6',
        borderRadius: '8px'
      }}>
        No construction events available
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: 'white',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        fontWeight: 'bold',
        display: 'grid',
        gridTemplateColumns: '80px 120px 180px 100px 60px 50px',
        gap: '15px',
        fontSize: '14px',
        color: '#495057'
      }}>
        <div>Time</div>
        <div>Unit Type</div>
        <div>Owner</div>
        <div>Location</div>
        <div>Level</div>
        <div>Map</div>
      </div>

      {/* Event rows */}
      <div style={{ 
        maxHeight: '400px', 
        overflowY: 'auto'
      }}>
        {sortedEvents.map((event, index) => {
          const player = getPlayerById(players, event.client_id);
          const playerColor = getPlayerColor_ByClientId(event.client_id);
          const playerName = player?.name || event.name || 'Unknown';

          return (
            <div 
              key={`${event.tick}-${event.x}-${event.y}-${index}`}
              style={{
                padding: '12px 15px',
                borderBottom: index < sortedEvents.length - 1 ? '1px solid #f1f3f4' : 'none',
                backgroundColor: index % 2 === 0 ? 'white' : '#fafbfc',
                display: 'grid',
                gridTemplateColumns: '80px 120px 180px 100px 60px 50px',
                gap: '15px',
                alignItems: 'center',
                fontSize: '13px'
              }}
            >
              {/* Timestamp */}
              <div style={{ 
                color: '#6c757d',
                fontFamily: 'monospace'
              }}>
                {tickToTime(event.tick)}
              </div>

              {/* Unit Type */}
              <div style={{ fontWeight: '500' }}>
                {unitTypeDisplay(event.unit_type)}
              </div>

              {/* Owner with color dot */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '8px'
              }}>
                <div 
                  style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: playerColor,
                    borderRadius: '50%',
                    border: '1px solid white',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                    flexShrink: 0
                  }}
                />
                <span style={{ 
                  color: '#495057',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {playerName}
                </span>
              </div>

              {/* Location */}
              <div style={{ 
                color: '#6c757d',
                fontFamily: 'monospace'
              }}>
                ({event.x}, {event.y})
              </div>

              {/* Level badge */}
              <div>
                <span style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}>
                  L{event.level}
                </span>
              </div>

              {/* MiniMap Spot */}
              <div>
                <MiniMapSpot
                  mapWidth={mapWidth}
                  mapHeight={mapHeight}
                  x={event.x}
                  y={event.y}
                  color={playerColor}
                  size={30}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div style={{ 
        padding: '10px 15px',
        backgroundColor: '#f8f9fa',
        borderTop: '1px solid #dee2e6',
        fontSize: '12px',
        color: '#6c757d',
        textAlign: 'center'
      }}>
        {sortedEvents.length} construction event{sortedEvents.length !== 1 ? 's' : ''}
        {sortedEvents.length > 0 && (
          <> • {tickToTime(sortedEvents[0].tick)} to {tickToTime(sortedEvents[sortedEvents.length - 1].tick)}</>
        )}
      </div>
    </div>
  );
};

export default ConstructionEventLog;
