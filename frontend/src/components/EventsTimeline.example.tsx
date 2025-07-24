import React from 'react';
import EventsTimeline from './EventsTimeline';
import { formatEventsForTimeline, GeneralEvent, DisplayEvent, GamePlayer } from '../utils/charts';

// Example usage of EventsTimeline component
const EventsTimelineExample: React.FC = () => {
  // Sample data - in real usage, this would come from props or API
  const sampleGeneralEvents: GeneralEvent[] = [
    {
      tick: 100,
      event_type: 'game_start',
      data: { map: 'test_map' }
    },
    {
      tick: 250,
      event_type: 'player_spawn',
      data: { player_id: 1, x: 10, y: 15 }
    },
    {
      tick: 450,
      event_type: 'unit_created',
      data: { player_id: 2, unit_type: 'warrior' }
    }
  ];

  const sampleDisplayEvents: DisplayEvent[] = [
    {
      tick: 150,
      message_type: 'chat',
      message: 'Hello everyone!',
      player_id: 1
    },
    {
      tick: 300,
      message_type: 'system',
      message: 'Player gained territory',
      player_id: 2,
      gold_amount: 150
    },
    {
      tick: 500,
      message_type: 'notification',
      message: 'Achievement unlocked',
      player_id: 1
    }
  ];

  const samplePlayers: GamePlayer[] = [
    {
      id: 'player1',
      client_id: 'client_1',
      small_id: 1,
      player_type: 'human',
      name: 'Alice',
      team: 1
    },
    {
      id: 'player2',
      client_id: 'client_2', 
      small_id: 2,
      player_type: 'human',
      name: 'Bob',
      team: 2
    }
  ];

  // Format events using the existing utility
  const formattedEvents = formatEventsForTimeline(sampleGeneralEvents, sampleDisplayEvents);

  return (
    <div style={{ padding: '20px' }}>
      <h2>EventsTimeline Component Example</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Usage:</h3>
        <pre style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '15px', 
          borderRadius: '4px',
          fontSize: '14px' 
        }}>
{`import EventsTimeline from './components/EventsTimeline';
import { formatEventsForTimeline } from './utils/charts';

// Format your events
const events = formatEventsForTimeline(generalEvents, displayEvents);

// Render the timeline
<EventsTimeline 
  events={events}
  players={players}
  height={600} // optional, defaults to 700
/>`}
        </pre>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Example Timeline:</h3>
        <EventsTimeline 
          events={formattedEvents}
          players={samplePlayers}
          height={400}
        />
      </div>

      <div>
        <h3>Component Features:</h3>
        <ul>
          <li>✅ 100% width card layout</li>
          <li>✅ Fixed max-height with overflow-y: auto</li>
          <li>✅ Three-column layout using CSS Grid:
            <ul>
              <li>Left: Formatted time (using tickToTime)</li>
              <li>Middle: Colored category pills (General=blue, Display=green)</li>
              <li>Right: Message with player names and extra details</li>
            </ul>
          </li>
          <li>✅ Optional icons per event type for quick visual parsing</li>
          <li>✅ Player name lookup by ID</li>
          <li>✅ Responsive and aligned columns</li>
          <li>✅ Consistent with existing project styling</li>
        </ul>
      </div>
    </div>
  );
};

export default EventsTimelineExample;
