import React from 'react';
import { TimelineEvent, GamePlayer, PlayerColorMap, tickToTime, truncate } from '../utils/charts';
import { getCategoryColor, getCategoryIcon, formatEventTypeLabel } from '../utils/eventDisplay';

interface EventLogProps {
  events: TimelineEvent[];
  players: GamePlayer[];
  colorMap: PlayerColorMap;
  height?: number;
}

// Performance optimization: memoize event rows
const EventRow = React.memo<{
  event: TimelineEvent;
  index: number;
  isLastRow: boolean;
  players: GamePlayer[];
}>(({ event, index, isLastRow, players }) => {
  const formatEventDetails = (event: TimelineEvent): string => {
    let details = event.message;
    
    // Add player name if available
    if (event.playerId !== undefined) {
      const player = players.find(p => p.small_id === event.playerId);
      const playerName = player?.name;
      if (playerName && !details.includes(playerName)) {
        details = `${playerName}: ${details}`;
      }
    }
    
    // Add gold amount if available
    if (event.goldAmount !== undefined && event.goldAmount !== null) {
      details += ` (${event.goldAmount} gold)`;
    }
    
    return details;
  };

  const details = formatEventDetails(event);

  return (
    <div 
      style={{
        padding: '12px 15px',
        borderBottom: !isLastRow ? '1px solid #f1f3f4' : 'none',
        backgroundColor: index % 2 === 0 ? 'white' : '#fafbfc',
        display: 'grid',
        gridTemplateColumns: '80px 120px 1fr',
        gap: '15px',
        alignItems: 'center',
        fontSize: '13px'
      }}
    >
      {/* Time Column */}
      <div style={{ 
        color: '#6c757d',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        textAlign: 'right'
      }}>
        {tickToTime(event.tick)}
      </div>

      {/* Type Column */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: getCategoryColor(event.type),
          color: 'white',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          <span>{getCategoryIcon(event.category, event.type)}</span>
          <span style={{ 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            maxWidth: '70px'
          }}>
            {formatEventTypeLabel(event.type)}
          </span>
        </div>
      </div>

      {/* Details Column */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        lineHeight: '1.4',
        wordBreak: 'break-word'
      }}>
        <div>
          <div style={{ fontWeight: '500', marginBottom: '2px' }}>
            {event.category}
          </div>
          <div 
            style={{ color: '#6c757d' }}
            title={details} // Full text on hover
          >
            {truncate(details, 120)}
          </div>
        </div>
      </div>
    </div>
  );
});

EventRow.displayName = 'EventRow';

const EventLog: React.FC<EventLogProps> = ({
  events,
  players,
  colorMap,
  height = 400
}) => {
  // Sort events by tick descending (most recent first) for better user experience
  const sortedEvents = [...events].sort((a, b) => b.tick - a.tick);

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
        No events available
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
        gridTemplateColumns: '80px 120px 1fr',
        gap: '15px',
        fontSize: '14px',
        color: '#495057'
      }}>
        <div>Time</div>
        <div>Type</div>
        <div>Event Details</div>
      </div>

      {/* Event rows */}
      <div style={{ 
        maxHeight: `${height}px`, 
        overflowY: 'auto'
      }}>
        {sortedEvents.map((event, index) => (
          <EventRow
            key={`${event.tick}-${event.category}-${index}`}
            event={event}
            index={index}
            isLastRow={index === sortedEvents.length - 1}
            players={players}
          />
        ))}
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
        {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
        {sortedEvents.length > 0 && (
          <> • {tickToTime(sortedEvents[sortedEvents.length - 1].tick)} to {tickToTime(sortedEvents[0].tick)}</>
        )}
        {/* Note: If performance becomes an issue with large datasets (20k+ events), consider using react-window */}
      </div>
    </div>
  );
};

export default EventLog;
