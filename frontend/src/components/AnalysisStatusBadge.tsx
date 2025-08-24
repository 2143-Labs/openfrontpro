import React from 'react';
import { AnalysisStatus } from '../utils/analysis';

interface AnalysisStatusBadgeProps {
  status: AnalysisStatus;
  gameId: string;
  isLoading?: boolean;
  onStartAnalysis?: (gameId: string) => void;
  onCancelAnalysis?: (gameId: string) => void;
}

const AnalysisStatusBadge: React.FC<AnalysisStatusBadgeProps> = ({
  status,
  gameId,
  isLoading = false,
  onStartAnalysis,
  onCancelAnalysis
}) => {
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
        <span style={{
          fontSize: '0.8em',
          color: '#6c757d'
        }}>
          Loading...
        </span>
      </div>
    );
  }

  switch (status.state) {
    case 'completed':
      return (
        <span style={{
          color: status.badgeColor.color,
          fontSize: '0.8em',
          padding: '2px 6px',
          backgroundColor: status.badgeColor.background,
          borderRadius: '3px'
        }}>
          ✓ {status.statusText}
        </span>
      );

    case 'queued':
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500',
            textTransform: 'capitalize',
            backgroundColor: status.badgeColor.background,
            color: status.badgeColor.color
          }}>
            {status.statusText}
          </span>
          {status.queueStatus === 'Pending' && onCancelAnalysis && (
            <button
              onClick={() => onCancelAnalysis(gameId)}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc3545',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 4px',
                borderRadius: '2px',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8d7da';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Cancel analysis"
            >
              ×
            </button>
          )}
        </div>
      );

    case 'none':
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <input
            type="checkbox"
            onChange={(e) => {
              if (e.target.checked && onStartAnalysis) {
                onStartAnalysis(gameId);
              }
            }}
            style={{
              cursor: 'pointer'
            }}
          />
          <span style={{
            fontSize: '0.8em',
            color: '#6c757d'
          }}>
            Start Analysis
          </span>
        </div>
      );

    default:
      return (
        <span style={{
          color: '#6c757d',
          fontSize: '0.8em'
        }}>
          {status.statusText}
        </span>
      );
  }
};

export default AnalysisStatusBadge;
