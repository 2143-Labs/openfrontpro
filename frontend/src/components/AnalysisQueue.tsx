import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface QueueItem {
  game_id: string;
  status: string;
  queued_for_sec: number; // seconds - note the API uses queued_for_sec
  started_at_unix_sec?: number | null;
}

// The API returns an array directly, not wrapped in an object
type AnalysisQueueResponse = QueueItem[];

const AnalysisQueue: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueData, setQueueData] = useState<QueueItem[]>([]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchQueueData = async () => {
    try {
      setError(null);
      const response = await fetch('/api/v1/analysis_queue');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch queue data: ${response.status}`);
      }
      
      const data: AnalysisQueueResponse = await response.json();
      const filteredData = (data || []).filter(
        item => item.status.toLowerCase() !== 'completed'
      );
      setQueueData(filteredData);
    } catch (err) {
      console.error('Error fetching analysis queue:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analysis queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();

    // Set up auto-refresh every 15 seconds
    const interval = setInterval(fetchQueueData, 15000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    if (loading) {
      return <LoadingSpinner />;
    }

    if (error) {
      return <ErrorMessage message={error} />;
    }

    if (queueData.length === 0) {
      return (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          color: '#6c757d',
          fontSize: '16px'
        }}>
          No items in analysis queue
        </div>
      );
    }

    return (
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        fontSize: '14px'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <th style={{ 
              padding: '12px 16px', 
              textAlign: 'left', 
              borderBottom: '2px solid #dee2e6',
              fontWeight: '600',
              color: '#495057'
            }}>
              Game ID
            </th>
            <th style={{ 
              padding: '12px 16px', 
              textAlign: 'left', 
              borderBottom: '2px solid #dee2e6',
              fontWeight: '600',
              color: '#495057'
            }}>
              Status
            </th>
            <th style={{ 
              padding: '12px 16px', 
              textAlign: 'left', 
              borderBottom: '2px solid #dee2e6',
              fontWeight: '600',
              color: '#495057'
            }}>
              Queued for
            </th>
          </tr>
        </thead>
        <tbody>
          {queueData.map((item, index) => (
            <tr 
              key={`${item.game_id}-${index}`}
              style={{ 
                borderBottom: '1px solid #dee2e6',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <td style={{ 
                padding: '12px 16px',
                fontFamily: 'monospace',
                fontWeight: '600',
                color: '#007bff'
              }}>
                {item.game_id}
              </td>
              <td style={{ 
                padding: '12px 16px',
                textTransform: 'capitalize'
              }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: item.status.toLowerCase() === 'pending' ? '#fff3cd' : 
                                 item.status.toLowerCase() === 'running' ? '#d1ecf1' : 
                                 item.status.toLowerCase() === 'completed' ? '#d4edda' : '#f8d7da',
                  color: item.status.toLowerCase() === 'pending' ? '#856404' :
                         item.status.toLowerCase() === 'running' ? '#0c5460' :
                         item.status.toLowerCase() === 'completed' ? '#155724' : '#721c24'
                }}>
                  {item.status}
                </span>
              </td>
              <td style={{ 
                padding: '12px 16px',
                fontFamily: 'monospace',
                color: '#6c757d'
              }}>
                {formatTime(item.queued_for_sec)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="analysis-queue" style={{
      background: '#f8f9fa',
      border: '1px solid #e9ecef',
      borderRadius: '8px',
      padding: '20px',
      height: '400px', // Match the existing single-game card height
      overflow: 'hidden',          // NEW
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '20px',
        paddingBottom: '10px',
        borderBottom: '1px solid #dee2e6'
      }}>
        <h3 style={{ 
          margin: 0, 
          color: '#2c3e50',
          fontSize: '1.4rem',
          fontWeight: '600'
        }}>
          Analysis Queue
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#6c757d'
        }}>
          <span>Auto-refresh: 15s</span>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: loading ? '#ffc107' : '#28a745',
            animation: loading ? 'pulse 1.5s ease-in-out infinite' : 'none'
          }} />
        </div>
      </div>
      
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
};

export default AnalysisQueue;
