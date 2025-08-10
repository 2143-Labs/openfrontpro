import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserData } from '../types';
import { 
  formatISODate, 
  getTimeAgoFromISO, 
  calculateTotalGames, 
  calculateWinRate, 
  calculateTotalWins, 
  calculateTotalLosses,
  getTimeAgo
} from '../utils';
import { LoadingSpinner, ErrorMessage } from './';
import { Link } from 'react-router-dom';
import { getUser } from '../services/api';

function UserDetail() {
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
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [userID]);

  const handleBackToLobbies = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="App">
        <main className="App-main">
          <div className="scoreboard-container">
            <div className="scoreboard-header">
              <button 
                onClick={handleBackToLobbies}
                className="back-button"
              >
                ← Back to Lobbies
              </button>
              <h1>User Detail</h1>
            </div>
            <LoadingSpinner />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <main className="App-main">
          <div className="scoreboard-container">
            <div className="scoreboard-header">
              <button 
                onClick={handleBackToLobbies}
                className="back-button"
              >
                ← Back to Lobbies
              </button>
              <h1>User Detail</h1>
            </div>
            <ErrorMessage message={error} />
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="App">
        <main className="App-main">
          <div className="scoreboard-container">
            <div className="scoreboard-header">
              <button 
                onClick={handleBackToLobbies}
                className="back-button"
              >
                ← Back to Lobbies
              </button>
              <h1>User Detail</h1>
            </div>
            <div className="empty-state">
              <p>User not found.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            onClick={handleBackToLobbies}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0056b3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#007bff';
            }}
          >
            ← Back to Lobbies
          </button>
          <div>
            <h1>User Detail</h1>
            <p>User ID: <strong style={{ fontFamily: 'monospace' }}>{userID}</strong></p>
          </div>
        </div>
      </header>
      
      <main className="App-main">
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '20px',
          padding: '20px'
        }}>
          {/* Basic User Information */}
          <section style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h2>👤 User Overview</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><strong>Username:</strong> {user.username || 'Unknown'}</div>
              <div><strong>User ID:</strong> <code>{user.user_id}</code></div>
              {user.openfront_player_data?.createdAt && (
                <>
                  <div><strong>Account Created:</strong> {formatISODate(user.openfront_player_data.createdAt)}</div>
                  <div><strong>Member since:</strong> {getTimeAgoFromISO(user.openfront_player_data.createdAt)}</div>
                </>
              )}
              <div><strong>Friends:</strong> {user.friends?.length || 0}</div>
            </div>
          </section>

          {/* Friends List */}
          {user.friends && user.friends.length > 0 && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>👥 Friends ({user.friends.length})</h2>
              <div style={{ 
                maxHeight: '200px', 
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
              }}>
                {user.friends.map((friendId, index) => (
                  <div key={friendId} style={{ 
                    padding: '8px', 
                    backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'transparent',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <code style={{ fontSize: '0.9em' }}>{friendId}</code>
                    <Link 
                      to={`/user/${friendId}`}
                      style={{ 
                        color: '#007bff', 
                        textDecoration: 'none', 
                        fontSize: '0.8em',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid #007bff'
                      }}
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* OpenFront Statistics */}
          {user.openfront_player_data?.stats && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>📊 OpenFront Statistics</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div><strong>Total Games:</strong> {calculateTotalGames(user.openfront_player_data.stats)}</div>
                <div><strong>Total Wins:</strong> {calculateTotalWins(user.openfront_player_data.stats)}</div>
                <div><strong>Total Losses:</strong> {calculateTotalLosses(user.openfront_player_data.stats)}</div>
                <div><strong>Win Rate:</strong> 
                  <span style={{
                    marginLeft: '8px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    fontWeight: 'bold',
                    backgroundColor: calculateWinRate(user.openfront_player_data.stats) >= 0.7 ? '#d4edda' : 
                                    calculateWinRate(user.openfront_player_data.stats) >= 0.5 ? '#fff3cd' : '#f8d7da',
                    color: calculateWinRate(user.openfront_player_data.stats) >= 0.7 ? '#155724' : 
                           calculateWinRate(user.openfront_player_data.stats) >= 0.5 ? '#856404' : '#721c24'
                  }}>
                    {(calculateWinRate(user.openfront_player_data.stats) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Recent Games from OpenFront Player Data */}
          {user.openfront_player_data?.games && user.openfront_player_data.games.length > 0 && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              gridColumn: '1 / -1' // Span all columns
            }}>
              <h2>🎮 Recent OpenFront Games</h2>
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
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Type</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.openfront_player_data.games.slice(0, 10).map((game, index) => (
                      <tr key={game.gameId} style={{ 
                        backgroundColor: index % 2 === 0 ? 'transparent' : '#f8f9fa'
                      }}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>
                          <Link 
                            to={`/game/${game.gameId}`}
                            style={{ 
                              color: '#007bff',
                              textDecoration: 'none',
                              fontFamily: 'monospace', 
                              fontSize: '0.8em'
                            }}
                          >
                            {game.gameId}
                          </Link>
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>{game.map}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>{game.mode}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>{game.difficulty}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>{game.type}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>
                          {getTimeAgoFromISO(game.start)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {user.openfront_player_data.games.length > 10 && (
                <p style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
                  Showing 10 of {user.openfront_player_data.games.length} games
                </p>
              )}
            </section>
          )}

          {/* Recent Games from Analysis */}
          {user.recent_games && user.recent_games.length > 0 && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              gridColumn: '1 / -1' // Span all columns
            }}>
              <h2>🔍 Recent Analyzed Games</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: '0.9em'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Game ID</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Client ID</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Name in Game</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Analysis Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.recent_games.slice(0, 15).map((game, index) => (
                      <tr key={`${game.game_id}-${game.client_id}`} style={{ 
                        backgroundColor: index % 2 === 0 ? 'transparent' : '#f8f9fa'
                      }}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>
                          <Link 
                            to={`/game/${game.game_id}`}
                            style={{ 
                              color: '#007bff',
                              textDecoration: 'none',
                              fontFamily: 'monospace', 
                              fontSize: '0.8em'
                            }}
                          >
                            {game.game_id}
                          </Link>
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>
                          <code style={{ fontSize: '0.8em' }}>{game.client_id}</code>
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>
                          {game.name_in_that_game || <em>Unknown</em>}
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6' }}>
                          {game.analysis_complete_time ? (
                            <span style={{ 
                              color: '#28a745',
                              fontSize: '0.8em',
                              padding: '2px 6px',
                              backgroundColor: '#d4edda',
                              borderRadius: '3px'
                            }}>
                              ✓ Analyzed {getTimeAgo(game.analysis_complete_time)}
                            </span>
                          ) : (
                            <span style={{ 
                              color: '#6c757d',
                              fontSize: '0.8em'
                            }}>
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {user.recent_games.length > 15 && (
                <p style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
                  Showing 15 of {user.recent_games.length} recent games
                </p>
              )}
            </section>
          )}
        </div>
      </main>
      
      <footer className="App-footer">
        <p>&copy; 2024 OpenFront.Pro. Connect and play together!</p>
      </footer>
    </div>
  );
}

export default UserDetail;
