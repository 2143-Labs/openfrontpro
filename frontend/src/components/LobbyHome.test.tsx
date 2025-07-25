import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LobbyHome from './LobbyHome';

// Mock the useLobbies hook
vi.mock('../hooks/useLobbies', () => ({
  useLobbies: () => ({
    lobbies: [],
    loading: false,
    error: null,
    completedFilter: '',
    setCompletedFilter: vi.fn(),
    hasAnalysisFilter: '',
    setHasAnalysisFilter: vi.fn(),
    afterFilter: '',
    setAfterFilter: vi.fn(),
    mapFilter: '',
    setMapFilter: vi.fn(),
    teamFilter: '',
    setTeamFilter: vi.fn(),
    sortBy: 'created_at',
    setSortBy: vi.fn(),
    getFilteredAndSortedLobbies: () => [],
    refreshLobbies: vi.fn(),
  }),
}));

// Mock the child components
vi.mock('./', () => ({
  FilterControls: () => <div data-testid="filter-controls">Filter Controls</div>,
  SortControls: () => <div data-testid="sort-controls">Sort Controls</div>,
  LobbiesTable: () => <div data-testid="lobbies-table">Lobbies Table</div>,
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
  ErrorMessage: ({ message }: { message: string }) => <div data-testid="error-message">{message}</div>,
  AnalysisQueue: () => <div data-testid="analysis-queue">Analysis Queue</div>,
}));

// Mock fetch for game analysis
globalThis.fetch = vi.fn();

describe('LobbyHome Component - Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear all cookies before each test
    document.cookie = '';
  });

  afterEach(() => {
    // Clean up cookies after each test
    document.cookie = '';
  });

  it('should show logout button when authenticated and handle logout correctly', async () => {
    // Step 1: Set up authentication cookie
    document.cookie = 'session_token=abc';

    // Step 2: Render LobbyHome component
    render(<LobbyHome />);

    // Wait for the component to check auth status
    await waitFor(() => {
      // Step 3: Assert Logout button is present
      expect(screen.getByText('🚪 Logout')).toBeTruthy();
    });

    // Verify authenticated state elements are visible
    expect(screen.getByText('🎉 You are logged in!')).toBeTruthy();
    expect(screen.getByText('🔗 Set Openfront ID')).toBeTruthy();

    // Verify login link is NOT visible when authenticated
    expect(screen.queryByText('🎮 Login with Discord')).toBeFalsy();

    // Step 4: Fire click event on Logout button
    const logoutButton = screen.getByText('🚪 Logout');
    fireEvent.click(logoutButton);

    // Step 5: Assert cookie no longer contains token
    await waitFor(() => {
      // Check that the session_token cookie has been deleted
      // When a cookie is deleted, it's set with an expiration date in the past
      const cookies = document.cookie;
      const hasValidSessionToken = cookies.includes('session_token=abc');
      expect(hasValidSessionToken).toBeFalsy();
    });

    // Step 6: Assert "Login with Discord" link is now visible
    await waitFor(() => {
      expect(screen.getByText('🎮 Login with Discord')).toBeTruthy();
    });

    // Verify authenticated elements are no longer visible
    expect(screen.queryByText('🎉 You are logged in!')).toBeFalsy();
    expect(screen.queryByText('🚪 Logout')).toBeFalsy();
    expect(screen.queryByText('🔗 Set Openfront ID')).toBeFalsy();
  });

  it('should show login link when not authenticated', async () => {
    // Don't set any authentication cookie
    render(<LobbyHome />);

    // Wait for component to check auth status
    await waitFor(() => {
      // Should show login link when not authenticated
      expect(screen.getByText('🎮 Login with Discord')).toBeTruthy();
    });

    // Should not show authenticated elements
    expect(screen.queryByText('🎉 You are logged in!')).toBeFalsy();
    expect(screen.queryByText('🚪 Logout')).toBeFalsy();
    expect(screen.queryByText('🔗 Set Openfront ID')).toBeFalsy();
  });

  it('should handle cookie changes for cross-tab synchronization', async () => {
    // Start without authentication
    render(<LobbyHome />);

    // Initially should show login link
    await waitFor(() => {
      expect(screen.getByText('🎮 Login with Discord')).toBeTruthy();
    });

    // Simulate setting cookie from another tab
    document.cookie = 'session_token=xyz';

    // Simulate visibility change (user switching back to tab)
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: true,
    });
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false,
    });

    // Fire visibility change event
    fireEvent(document, new Event('visibilitychange'));

    // Should now show authenticated state
    await waitFor(() => {
      expect(screen.getByText('🎉 You are logged in!')).toBeTruthy();
      expect(screen.getByText('🚪 Logout')).toBeTruthy();
    });

    // Login link should no longer be visible
    expect(screen.queryByText('🎮 Login with Discord')).toBeFalsy();
  });
});
