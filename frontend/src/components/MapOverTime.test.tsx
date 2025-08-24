import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MapOverTime from './MapOverTime';

// Mock the charts utilities
vi.mock('../utils/charts', () => ({
  createPlayerColorMap: vi.fn(() => new Map([['player1', '#1f77b4']])),
  getPlayerColorById: vi.fn(() => '#1f77b4'),
  tickToTime: vi.fn((tick: number) => `${Math.floor(tick / 10)}s`),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MapOverTime', () => {
  const mockPlayers = [
    {
      id: 'player1',
      client_id: 'player1',
      name: 'Alice',
      small_id: 1,
      player_type: 'HUMAN'
    }
  ];

  const mockConstructionEvents = [
    {
      tick: 10,
      unit_type: 'city',
      x: 100,
      y: 200,
      level: 1,
      small_id: 1,
      client_id: 'player1',
      name: 'Alice'
    },
    {
      tick: 50,
      unit_type: 'port',
      x: 150,
      y: 250,
      level: 1,
      small_id: 1,
      client_id: 'player1',
      name: 'Alice'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ events: mockConstructionEvents })
      }), 100))
    );

    render(
      <MapOverTime 
        gameId="test123" 
        players={mockPlayers}
        mapWidth={1000}
        mapHeight={1000}
        maxRenderWidth={400}
      />
    );

    expect(screen.getByText('Loading construction timeline...')).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(
      <MapOverTime 
        gameId="test123" 
        players={mockPlayers}
        mapWidth={1000}
        mapHeight={1000}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });

  it('renders construction events successfully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: mockConstructionEvents })
    });

    render(
      <MapOverTime 
        gameId="test123" 
        players={mockPlayers}
        mapWidth={1000}
        mapHeight={1000}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1 structures')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument(); // slider at first tick
    });
  });

  it('updates visible events when slider moves', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: mockConstructionEvents })
    });

    render(
      <MapOverTime 
        gameId="test123" 
        players={mockPlayers}
        mapWidth={1000}
        mapHeight={1000}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1 structures')).toBeInTheDocument();
    });

    // Move slider to show more events
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '50' } });

    await waitFor(() => {
      expect(screen.getByText('2 structures')).toBeInTheDocument();
    });
  });

  it('shows play controls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: mockConstructionEvents })
    });

    render(
      <MapOverTime 
        gameId="test123" 
        players={mockPlayers}
        mapWidth={1000}
        mapHeight={1000}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('▶️ Play')).toBeInTheDocument();
      expect(screen.getByText('⏮️ Reset')).toBeInTheDocument();
      expect(screen.getByText('1x Speed')).toBeInTheDocument(); // speed selector option
    });
  });

  it('handles empty events list', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [] })
    });

    render(
      <MapOverTime 
        gameId="test123" 
        players={mockPlayers}
        mapWidth={1000}
        mapHeight={1000}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No construction events found for this game.')).toBeInTheDocument();
    });
  });
});
