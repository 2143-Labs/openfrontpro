import React from 'react';
import { render, screen } from '@testing-library/react';
import EventLog from './EventLog';
import { TimelineEvent, GamePlayer } from '../utils/charts';
import { truncate } from '../utils/charts';

// Mock players for testing
const mockPlayers: GamePlayer[] = [
  {
    id: 'player1',
    client_id: 'client1',
    small_id: 1,
    player_type: 'human',
    name: 'Test Player 1',
  },
  {
    id: 'player2',
    client_id: 'client2',
    small_id: 2,
    player_type: 'human',
    name: 'Test Player 2',
  },
];

// Mock color map
const mockColorMap = new Map([
  ['client1', '#1f77b4'],
  ['client2', '#ff7f0e'],
]);

// Create dummy events for testing
const createDummyEvents = (count: number): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  for (let i = 0; i < count; i++) {
    events.push({
      tick: i * 100,
      type: i % 2 === 0 ? 'general' : 'display',
      category: i % 2 === 0 ? 'ConquestEvent' : 'chat',
      message: `Test event ${i} with some details`,
      playerId: (i % 2) + 1,
    });
  }
  return events;
};

describe('EventLog', () => {
  test('renders empty state correctly', () => {
    render(
      <EventLog
        events={[]}
        players={mockPlayers}
        colorMap={mockColorMap}
      />
    );
    
    expect(screen.getByText('No events available')).toBeInTheDocument();
  });

  test('renders events with correct structure', () => {
    const events = createDummyEvents(5);
    
    render(
      <EventLog
        events={events}
        players={mockPlayers}
        colorMap={mockColorMap}
        height={300}
      />
    );
    
    // Check header
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Event Details')).toBeInTheDocument();
    
    // Check event count in footer (text may be split across elements)
    expect(screen.getByText(/5.*events?/)).toBeInTheDocument();
    
    // Check that events are rendered (should be in reverse chronological order)
    // The text is in the title attribute and actual content with player names
    expect(screen.getByText(/Test Player 1: Test event 4 with some details/)).toBeInTheDocument();
    expect(screen.getByText(/Test Player 1: Test event 0 with some details/)).toBeInTheDocument();
  });

  test('handles large number of events without breaking', () => {
    // Test with a substantial number of events to verify performance doesn't break
    const events = createDummyEvents(1000);
    
    const { container } = render(
      <EventLog
        events={events}
        players={mockPlayers}
        colorMap={mockColorMap}
        height={400}
      />
    );
    
    // Should render footer with correct count (text may be split)
    expect(screen.getByText(/1000.*events?/)).toBeInTheDocument();
    
    // Should have scrollable container
    const scrollableDiv = container.querySelector('[style*="overflow-y: auto"]');
    expect(scrollableDiv).toBeTruthy();
  });

  test('applies correct styling for different event types', () => {
    const events: TimelineEvent[] = [
      {
        tick: 100,
        type: 'general',
        category: 'ConquestEvent',
        message: 'General event',
      },
      {
        tick: 200,
        type: 'display',
        category: 'chat',
        message: 'Display event',
      },
    ];
    
    render(
      <EventLog
        events={events}
        players={mockPlayers}
        colorMap={mockColorMap}
      />
    );
    
    // Both event types should be present
    expect(screen.getByText('ConquestEvent')).toBeInTheDocument();
    expect(screen.getByText('chat')).toBeInTheDocument();
  });
});

describe('truncate utility', () => {
  test('truncates long strings correctly', () => {
    const longString = 'This is a very long string that should be truncated at the specified length and have an ellipsis added at the end to indicate it was cut off';
    const result = truncate(longString, 50);
    
    expect(result).toHaveLength(50);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('cut off');
  });

  test('leaves short strings unchanged', () => {
    const shortString = 'Short string';
    const result = truncate(shortString, 50);
    
    expect(result).toBe(shortString);
    expect(result).not.toContain('…');
  });

  test('handles default length', () => {
    const longString = 'A'.repeat(150);
    const result = truncate(longString);
    
    expect(result).toHaveLength(120);
    expect(result.endsWith('…')).toBe(true);
  });

  test('handles edge cases', () => {
    expect(truncate('', 10)).toBe('');
    expect(truncate('x', 1)).toBe('x');
    expect(truncate('xy', 1)).toBe('…');
  });
});
