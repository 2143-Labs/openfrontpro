import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTimeAgo, formatTimestamp } from '../utils';
import { getUser } from '../services/api';
import { UserData } from '../types';

const UserDetail: React.FC = () => {
  const { userID } = useParams<{ userID: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!userID) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const userData = await getUser(userID);
        setUser(userData);
      } catch (err) {
        console.error('Error fetching user details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch user details');
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [userID]);

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="user-detail">
        <button onClick={handleBack} className="back-button">
          ← Back
        </button>
        <h1>User Detail</h1>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading user details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-detail">
        <button onClick={handleBack} className="back-button">
          ← Back
        </button>
        <h1>User Detail</h1>
        <div style={{ textAlign: 'center', padding: '40px', color: '#dc3545' }}>
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-detail">
        <button onClick={handleBack} className="back-button">
          ← Back
        </button>
        <h1>User Detail</h1>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>User not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-detail">
      <button onClick={handleBack} className="back-button">
        ← Back
      </button>
      <h1>User {user.username}</h1>

      <div className="stats-sections">
        <section className="stats-section">
          <h2>Basic Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div><strong>User ID:</strong> <code>{user.user_id}</code></div>
            <div><strong>Username:</strong> {user.username}</div>
            <div><strong>Member since:</strong> {formatTimestamp(user.created_unix_sec)}</div>
            <div><strong>Created:</strong> {getTimeAgo(user.created_unix_sec)}</div>
          </div>
        </section>

        <section className="stats-section">
          <h2>Friends List</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {user.friends && user.friends.length > 0 ? (
              <>
                <div><strong>Total Friends:</strong> {user.friends.length}</div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {user.friends.map((friendId, index) => (
                    <div key={friendId} style={{ 
                      padding: '8px', 
                      backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'transparent',
                      borderRadius: '4px'
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                        {friendId}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div>No friends found.</div>
            )}
          </div>
        </section>

        <section className="stats-section">
          <h2>OpenFront Statistics</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div><strong>Total Games:</strong> {user.stats.games_played}</div>
            <div><strong>Games Won:</strong> {user.stats.wins}</div>
            <div><strong>Games Lost:</strong> {user.stats.losses}</div>
            <div><strong>Win Rate:</strong> 
              <span style={{
                marginLeft: '8px',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.9em',
                fontWeight: 'bold',
                backgroundColor: user.stats.win_rate >= 0.7 ? '#d4edda' : 
                                user.stats.win_rate >= 0.5 ? '#fff3cd' : '#f8d7da',
                color: user.stats.win_rate >= 0.7 ? '#155724' : 
                       user.stats.win_rate >= 0.5 ? '#856404' : '#721c24'
              }}>
                {(user.stats.win_rate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </section>

        <section className="stats-section">
          <h2>Recent Game History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {user.game_history && user.game_history.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: '0.9em'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Game ID</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Map</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Mode</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Difficulty</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Start Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.game_history.map((game, index) => (
                      <tr key={game.game_id} style={{ 
                        backgroundColor: index % 2 === 0 ? 'transparent' : '#f8f9fa'
                      }}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6', fontFamily: 'monospace', fontSize: '0.8em' }}>{game.game_id}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>{game.map}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>{game.mode}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>{game.difficulty}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>
                          {getTimeAgo(game.start_time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>No recent games found.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default UserDetail;
