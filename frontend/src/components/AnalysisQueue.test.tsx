import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AnalysisQueue from './AnalysisQueue';

// Mock fetch
globalThis.fetch = vi.fn();

describe('AnalysisQueue Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show loading spinner initially', async () => {
    // Mock fetch to never resolve to keep loading state
    (fetch as any).mockImplementation(() => new Promise(() => {}));

    render(<AnalysisQueue />);

    // Verify loading spinner appears
    expect(screen.getByTestId('loading-spinner') || screen.getByRole('status')).toBeTruthy();
  });

  it('should render queue rows correctly with converted time', async () => {
    const mockData = {
      queue: [
        { game_id: 'ABC12345', status: 'pending', queued_for: 3661 }, // 1:01:01
        { game_id: 'DEF67890', status: 'processing', queued_for: 125 }, // 0:02:05
        { game_id: 'GHI11111', status: 'completed', queued_for: 0 }, // 0:00:00
      ]
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<AnalysisQueue />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('ABC12345')).toBeTruthy();
    });

    // Verify all game IDs are displayed
    expect(screen.getByText('ABC12345')).toBeTruthy();
    expect(screen.getByText('DEF67890')).toBeTruthy();
    expect(screen.getByText('GHI11111')).toBeTruthy();

    // Verify time conversion is correct
    expect(screen.getByText('01:01:01')).toBeTruthy(); // 3661 seconds
    expect(screen.getByText('00:02:05')).toBeTruthy(); // 125 seconds
    expect(screen.getByText('00:00:00')).toBeTruthy(); // 0 seconds

    // Verify status badges are displayed
    expect(screen.getByText('pending')).toBeTruthy();
    expect(screen.getByText('processing')).toBeTruthy();
    expect(screen.getByText('completed')).toBeTruthy();
  });

  it('should handle auto-refresh and update list', async () => {
    let callCount = 0;
    const mockResponses = [
      { queue: [{ game_id: 'FIRST001', status: 'pending', queued_for: 100 }] },
      { queue: [{ game_id: 'SECOND02', status: 'processing', queued_for: 200 }] }
    ];

    (fetch as any).mockImplementation(async () => {
      const response = mockResponses[callCount];
      callCount++;
      return {
        ok: true,
        json: async () => response,
      };
    });

    render(<AnalysisQueue />);

    // Wait for initial data
    await waitFor(() => {
      expect(screen.getByText('FIRST001')).toBeTruthy();
    });

    // Fast-forward time to trigger auto-refresh (15 seconds)
    vi.advanceTimersByTime(15000);

    // Wait for the refresh to complete
    await waitFor(() => {
      expect(screen.getByText('SECOND02')).toBeTruthy();
    });

    // Verify the old data is gone and new data is present
    expect(screen.queryByText('FIRST001')).toBeFalsy();
    expect(screen.getByText('SECOND02')).toBeTruthy();
    expect(screen.getByText('processing')).toBeTruthy();
  });

  it('should display error message when endpoint is unreachable', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<AnalysisQueue />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeTruthy();
      expect(screen.getByText(/Network error/)).toBeTruthy();
    });
  });

  it('should display error message for non-ok response', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<AnalysisQueue />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeTruthy();
      expect(screen.getByText(/Failed to fetch queue data: 500/)).toBeTruthy();
    });
  });

  it('should display empty state when no items in queue', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ queue: [] }),
    });

    render(<AnalysisQueue />);

    await waitFor(() => {
      expect(screen.getByText('No items in analysis queue')).toBeTruthy();
    });
  });

  it('should have proper responsive structure', () => {
    (fetch as any).mockImplementation(() => new Promise(() => {}));
    
    const { container } = render(<AnalysisQueue />);
    
    // Check that the main container has proper structure for responsive design
    const analysisQueue = container.querySelector('.analysis-queue');
    expect(analysisQueue).toBeTruthy();
    
    // The component should be wrapped in a container that's responsive
    // The CSS rules should handle the mobile breakpoint at 768px
    expect(analysisQueue).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
    });
  });

  it('should show auto-refresh indicator', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ queue: [] }),
    });

    render(<AnalysisQueue />);

    await waitFor(() => {
      expect(screen.getByText('Auto-refresh: 15s')).toBeTruthy();
    });
  });

  it('should format time correctly for various durations', () => {
    const mockData = {
      queue: [
        { game_id: 'TEST0001', status: 'pending', queued_for: 0 },      // 0:00:00
        { game_id: 'TEST0059', status: 'pending', queued_for: 59 },     // 0:00:59
        { game_id: 'TEST0060', status: 'pending', queued_for: 60 },     // 0:01:00  
        { game_id: 'TEST3599', status: 'pending', queued_for: 3599 },   // 0:59:59
        { game_id: 'TEST3600', status: 'pending', queued_for: 3600 },   // 1:00:00
        { game_id: 'TEST7261', status: 'pending', queued_for: 7261 },   // 2:01:01
      ]
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<AnalysisQueue />);

    waitFor(() => {
      expect(screen.getByText('00:00:00')).toBeTruthy();
      expect(screen.getByText('00:00:59')).toBeTruthy(); 
      expect(screen.getByText('00:01:00')).toBeTruthy();
      expect(screen.getByText('00:59:59')).toBeTruthy();
      expect(screen.getByText('01:00:00')).toBeTruthy();
      expect(screen.getByText('02:01:01')).toBeTruthy();
    });
  });
});
