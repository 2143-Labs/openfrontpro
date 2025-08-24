import React from 'react';
import { TimelineEvent, GamePlayer, tickToTime } from '../utils/charts';
import { getCategoryColor, getCategoryIcon, formatEventTypeLabel } from '../utils/eventDisplay';


interface EventsTimelineProps {
  events: TimelineEvent[];
  players: GamePlayer[];
  height?: number;
}

const EventsTimeline: React.FC<EventsTimelineProps> = ({ 
  events, 
  players, 
  height = 700 
}) => {
  // Create a lookup map for players by small_id for quick access
  const playerLookup = React.useMemo(() => {
    const lookup = new Map<number, GamePlayer>();
    players.forEach(player => {
      lookup.set(player.small_id, player);
    });
    return lookup;
  }, [players]);

  const getPlayerName = (playerId?: number): string => {
    if (playerId === undefined || playerId === null) return '';
    const player = playerLookup.get(playerId);
    return player ? player.name : `Player ${playerId}`;
  };


  const formatEventDetails = (event: TimelineEvent): string => {
    let details = event.message;
    
    // Add player name if available
    if (event.playerId !== undefined) {
      const playerName = getPlayerName(event.playerId);
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

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: `${height}px`,
    backgroundColor: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const headerStyle: React.CSSProperties = {
    padding: '15px 20px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #dee2e6',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#495057'
  };

  const timelineContainerStyle: React.CSSProperties = {
    height: `${height - 60}px`, // Account for header
    overflowY: 'auto',
    padding: '0'
  };

  const timelineGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '80px 120px 1fr',
    gap: '0',
    minHeight: '100%'
  };

  const eventRowStyle: React.CSSProperties = {
    display: 'contents'
  };

  const timeColumnStyle: React.CSSProperties = {
    padding: '12px 15px',
    fontSize: '12px',
    color: '#6c757d',
    borderBottom: '1px solid #f1f3f4',
    backgroundColor: '#f8f9fa',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textAlign: 'right',
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end'
  };

  const categoryColumnStyle = (event: TimelineEvent): React.CSSProperties => ({
    padding: '8px 12px',
    borderBottom: '1px solid #f1f3f4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  });

  const categoryPillStyle = (event: TimelineEvent): React.CSSProperties => ({
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
  });

  const messageColumnStyle: React.CSSProperties = {
    padding: '12px 15px',
    fontSize: '14px',
    borderBottom: '1px solid #f1f3f4',
    display: 'flex',
    alignItems: 'center',
    lineHeight: '1.4',
    wordBreak: 'break-word'
  };

  if (events.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          Events Timeline
        </div>
        <div style={{ 
          ...timelineContainerStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6c757d'
        }}>
          No events to display
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        Events Timeline ({events.length} events)
      </div>
      <div style={timelineContainerStyle}>
        <div style={timelineGridStyle}>
          {events.map((event, index) => (
            <div key={index} style={eventRowStyle}>
              {/* Time Column */}
              <div style={timeColumnStyle}>
                {tickToTime(event.tick)}
              </div>
              
              {/* Category Column */}
              <div style={categoryColumnStyle(event)}>
                <div style={categoryPillStyle(event)}>
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
              
              {/* Message Column */}
              <div style={messageColumnStyle}>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                    {event.category}
                  </div>
                  <div style={{ color: '#6c757d' }}>
                    {formatEventDetails(event)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventsTimeline;
