import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnalysisStatusBadge from '../AnalysisStatusBadge';
import { getAnalysisStatus } from '../../utils/analysis';

// Mock the analysis status utility
jest.mock('../../utils/analysis');
const mockGetAnalysisStatus = getAnalysisStatus as jest.MockedFunction<typeof getAnalysisStatus>;

describe('AnalysisStatusBadge', () => {
  const mockOnStartAnalysis = jest.fn();
  const mockOnCancelAnalysis = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders completed status with green badge', () => {
    const status = {
      state: 'completed' as const,
      statusText: 'Analyzed',
      badgeColor: {
        background: '#d4edda',
        color: '#155724'
      }
    };

    render(
      <AnalysisStatusBadge 
        status={status}
        gameId="test123"
      />
    );

    const badge = screen.getByText(/✓ Analyzed/);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({
      backgroundColor: '#d4edda',
      color: '#155724'
    });
  });

  test('renders queued status with colored badge and cancel button', () => {
    const status = {
      state: 'queued' as const,
      statusText: 'Pending',
      queueStatus: 'Pending',
      badgeColor: {
        background: '#fff3cd',
        color: '#856404'
      }
    };

    render(
      <AnalysisStatusBadge 
        status={status}
        gameId="test123"
        onCancelAnalysis={mockOnCancelAnalysis}
      />
    );

    const badge = screen.getByText('Pending');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({
      backgroundColor: '#fff3cd',
      color: '#856404'
    });

    const cancelButton = screen.getByRole('button', { name: /cancel analysis/i });
    expect(cancelButton).toBeInTheDocument();
  });

  test('renders checkbox for non-queued games and triggers start analysis', () => {
    const status = {
      state: 'none' as const,
      statusText: 'Not queued',
      badgeColor: {
        background: '#f8f9fa',
        color: '#6c757d'
      }
    };

    render(
      <AnalysisStatusBadge 
        status={status}
        gameId="test123"
        onStartAnalysis={mockOnStartAnalysis}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    const startText = screen.getByText('Start Analysis');
    
    expect(checkbox).toBeInTheDocument();
    expect(startText).toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(mockOnStartAnalysis).toHaveBeenCalledWith('test123');
  });

  test('renders loading state with spinner', () => {
    const status = {
      state: 'none' as const,
      statusText: 'Loading...',
      badgeColor: {
        background: '#f8f9fa',
        color: '#6c757d'
      }
    };

    render(
      <AnalysisStatusBadge 
        status={status}
        gameId="test123"
        isLoading={true}
      />
    );

    const loadingText = screen.getByText('Loading...');
    expect(loadingText).toBeInTheDocument();
  });

  test('cancel button triggers cancel analysis function', () => {
    const status = {
      state: 'queued' as const,
      statusText: 'Pending',
      queueStatus: 'Pending',
      badgeColor: {
        background: '#fff3cd',
        color: '#856404'
      }
    };

    render(
      <AnalysisStatusBadge 
        status={status}
        gameId="test123"
        onCancelAnalysis={mockOnCancelAnalysis}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel analysis/i });
    fireEvent.click(cancelButton);
    
    expect(mockOnCancelAnalysis).toHaveBeenCalledWith('test123');
  });
});
