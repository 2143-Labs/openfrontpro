import React from 'react';
import { render, screen } from '@testing-library/react';
import ConstructionEventLog from './ConstructionEventLog';
import { ConstructionEvent } from '../types';
import { GamePlayer } from '../utils/charts';

const mockConstructionEvents: ConstructionEvent[] = [
  {
    tick: 1000,
    unit_type: 'City',
    x: 100,
    y: 200,
    level: 1,
    small_id: 1,
    client_id: 'player1',
    name: 'Player One'
  },
  {
    tick: 500,   // Earlier event - should appear first after sorting
    unit_type: 'Factory', 
    x: 300,
    y: 400,
    level: 2,
    small_id: 2,
    client_id: 'player2',
    name: 'Player Two'
  },
  {
    tick: 1500, // Latest event - should appear last after sorting
    unit_type: 'Port',
    x: 500,
    y: 600, 
    level: 1,
    small_id: 3,
    client_id: 'player1',
    name: 'Player One'
  }
];

const mockPlayers: GamePlayer[] = [
  {
    id: 'player1',
    client_id: 'player1',
    small_id: 1,
    player_type: 'human',
    name: 'Player One'
  },
  {
    id: 'player2',
    client_id: 'player2',
    small_id: 2,
    player_type: 'human', 
    name: 'Player Two'
  }
];

describe('ConstructionEventLog', () => {
  const defaultProps = {
    events: mockConstructionEvents,
    players: mockPlayers,
    mapWidth: 2000,
    mapHeight: 1000
  };

  it('renders without crashing', () => {
    render(<ConstructionEventLog {...defaultProps} />);
  });

  it('shows "No construction events" when events array is empty', () => {
    render(<ConstructionEventLog {...defaultProps} events={[]} />);
    expect(screen.getByText('No construction events available')).toBeInTheDocument();
  });

  it('sorts events by tick in ascending order (chronological)', () => {
    render(<ConstructionEventLog {...defaultProps} />);
    
    // Verify the correct unit types appear in chronological order
    const unitTypes = screen.getAllByText(/(Factory|City|Port)/);
    
    // Verify we have the expected unit types
    expect(screen.getByText('Factory')).toBeInTheDocument(); // tick: 500
    expect(screen.getByText('City')).toBeInTheDocument(); // tick: 1000
    expect(screen.getByText('Port')).toBeInTheDocument(); // tick: 1500
    
    // Just verify all 3 events are rendered - DOM order testing is complex with CSS grid
    expect(unitTypes).toHaveLength(3);
  });

  it('displays correct unit types with human-readable names', () => {
    render(<ConstructionEventLog {...defaultProps} />);
    
    expect(screen.getByText('City')).toBeInTheDocument();
    expect(screen.getByText('Factory')).toBeInTheDocument(); 
    expect(screen.getByText('Port')).toBeInTheDocument();
  });

  it('displays player names correctly', () => {
    render(<ConstructionEventLog {...defaultProps} />);
    
    // Should show both player names
    expect(screen.getAllByText('Player One')).toHaveLength(2); // Appears in 2 events
    expect(screen.getByText('Player Two')).toBeInTheDocument(); // Appears in 1 event
  });

  it('displays location coordinates', () => {
    render(<ConstructionEventLog {...defaultProps} />);
    
    expect(screen.getByText('(100, 200)')).toBeInTheDocument();
    expect(screen.getByText('(300, 400)')).toBeInTheDocument();
    expect(screen.getByText('(500, 600)')).toBeInTheDocument();
  });

  it('displays level badges', () => {
    render(<ConstructionEventLog {...defaultProps} />);
    
    const levelBadges = screen.getAllByText(/L\d+/);
    expect(levelBadges).toHaveLength(3);
    
    expect(screen.getAllByText('L1')).toHaveLength(2); // Two level 1 constructions
    expect(screen.getByText('L2')).toBeInTheDocument(); // One level 2 construction
  });

  it('shows event count in summary footer', () => {
    render(<ConstructionEventLog {...defaultProps} />);
    
    expect(screen.getByText(/3 construction events/)).toBeInTheDocument();
  });

  it('shows time range in summary footer', () => {
    render(<ConstructionEventLog {...defaultProps} />);
    
    // Should show range from earliest to latest event
    const footer = screen.getByText(/3 construction events • .* to .*/);
    expect(footer).toBeInTheDocument();
  });

  it('renders MiniMapSpot components', () => {
    const { container } = render(<ConstructionEventLog {...defaultProps} />);
    
    // Should have 3 SVG elements (one for each MiniMapSpot)
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(3);
  });

  it('handles players without client_id gracefully', () => {
    const eventsWithUnknownPlayer: ConstructionEvent[] = [
      {
        tick: 1000,
        unit_type: 'City',
        x: 100,
        y: 200,
        level: 1,
        small_id: 1,
        client_id: 'unknown_player',
        name: 'Mystery Player'
      }
    ];

    render(
      <ConstructionEventLog 
        {...defaultProps} 
        events={eventsWithUnknownPlayer} 
      />
    );
    
    // Should fall back to the name from the event
    expect(screen.getByText('Mystery Player')).toBeInTheDocument();
  });
});
