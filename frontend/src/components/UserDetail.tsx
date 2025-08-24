import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
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
import { 
  fetchUser, 
  fetchAnalysisQueue, 
  markGameForAnalysis, 
  unmarkGameForAnalysis,
  fetchUserIfNeeded,
  fetchUsersBatch,
  cacheUser
} from '../services/api';
import { getAnalysisStatus } from '../utils/analysis';
import { AnalysisQueueEntry } from '../types';
import AnalysisStatusBadge from './AnalysisStatusBadge';

// Type for tracking friend loading state
type FriendMeta = {
  loading: boolean;
  error?: string;
  data?: UserData;
};

function UserDetail() {
  const { userID } = useParams<{ userID: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Friends lazy loading state
  const [friends, setFriends] = useState<Record<string, FriendMeta>>({});
  
  // Analysis queue state
  const [analysisQueue, setAnalysisQueue] = useState<AnalysisQueueEntry[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());

  // Check for pre-loaded user data and fetch user data and analysis queue
  useEffect(() => {
    const preloadedUser = location.state?.userData as UserData | undefined;
    if (preloadedUser && preloadedUser.user_id === userID) {
      console.log('Using pre-loaded user data for instant navigation');
      setUser(preloadedUser);
      cacheUser(preloadedUser); // Ensure it's cached
      setLoading(false);
      
      // Still need to fetch analysis queue
      const fetchQueue = async () => {
        try {
          setQueueLoading(true);
          setQueueError(null);
          const queueData = await fetchAnalysisQueue();
          setAnalysisQueue(queueData);
        } catch (err) {
          console.error('Error fetching analysis queue:', err);
          setQueueError(err instanceof Error ? err.message : 'Failed to fetch analysis queue');
        } finally {
          setQueueLoading(false);
        }
      };
      fetchQueue();
      return;
    }

    const fetchData = async () => {
      if (!userID) return;
      
      try {
        setLoading(true);
        setQueueLoading(true);
        setError(null);
        setQueueError(null);
        
        const [userData, queueData] = await Promise.all([
          fetchUserIfNeeded(userID),
          fetchAnalysisQueue()
        ]);
        
        setUser(userData);
        setAnalysisQueue(queueData);
      } catch (err) {
        if (err instanceof Error) {
          console.error('Error fetching data:', err);
          if (err.message.includes('analysis_queue')) {
            setQueueError(err.message);
          } else {
            setError(err.message);
          }
        } else {
          setError('Failed to fetch user data');
        }
      } finally {
        setLoading(false);
        setQueueLoading(false);
      }
    };

    fetchData();
  }, [userID, location.state]);

  // Lazy load friend data after user is loaded
  useEffect(() => {
    if (!user || !user.friends || user.friends.length === 0) return;

    console.log('Starting lazy load of friend data for', user.friends.length, 'friends');
    
    // Reset friends state for new user
    setFriends({});

    // Set all friends to loading state
    const friendIds = user.friends;
    const initialFriends: Record<string, FriendMeta> = {};
    friendIds.forEach(id => {
      initialFriends[id] = { loading: true };
    });
    setFriends(initialFriends);

    // Fetch friend data in batches
    fetchUsersBatch(friendIds)
      .then(results => {
        console.log('Friend batch loading completed:', results);
        setFriends(prevFriends => {
          const newFriends = { ...prevFriends };
          for (const [id, result] of Object.entries(results)) {
            if (result instanceof Error) {
              newFriends[id] = { loading: false, error: result.message };
            } else {
              newFriends[id] = { loading: false, data: result };
            }
          }
          return newFriends;
        });
      })
      .catch(err => {
        console.error('Error loading friend data:', err);
        // Set all friends to error state
        setFriends(prevFriends => {
          const newFriends = { ...prevFriends };
          for (const id of friendIds) {
            newFriends[id] = { loading: false, error: 'Failed to load friend data' };
          }
          return newFriends;
        });
      });
  }, [user]);

  // Auto-refresh analysis queue every 15 seconds
  useEffect(() => {
    if (!user?.recent_games || user.recent_games.length === 0) return;
    
    const interval = setInterval(() => {
      refreshQueue();
    }, 15000);

    return () => clearInterval(interval);
  }, [user]);

  const refreshQueue = async () => {
    try {
      const queueData = await fetchAnalysisQueue();
      setAnalysisQueue(queueData);
      setQueueError(null);
    } catch (err) {
      console.error('Error refreshing analysis queue:', err);
      setQueueError(err instanceof Error ? err.message : 'Failed to refresh analysis queue');
    }
  };

  const handleStartAnalysis = async (gameId: string) => {
    setPendingOperations(prev => new Set(prev).add(gameId));
    
    try {
      await markGameForAnalysis(gameId);
      await refreshQueue();
    } catch (err) {
      console.error('Error starting analysis:', err);
      setQueueError(err instanceof Error ? err.message : 'Failed to start analysis');
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(gameId);
        return newSet;
      });
    }
  };

  const handleCancelAnalysis = async (gameId: string) => {
    setPendingOperations(prev => new Set(prev).add(gameId));
    
    try {
      await unmarkGameForAnalysis(gameId);
      await refreshQueue();
    } catch (err) {
      console.error('Error canceling analysis:', err);
      setQueueError(err instanceof Error ? err.message : 'Failed to cancel analysis');
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(gameId);
        return newSet;
      });
    }
  };

  const handleBackToLobbies = () => {
    navigate('/');
  };

  const handleViewFriend = (friendId: string) => {
    const meta = friends[friendId];
    if (meta?.data) {
      // Use pre-loaded friend data for instant navigation
      navigate(`/user/${friendId}`, { 
        state: { userData: meta.data }
      });
    } else {
      // Fall back to normal navigation if data isn't available
      navigate(`/user/${friendId}`);
    }
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
                {user.friends.map((friendId, index) => {
                  const meta = friends[friendId];
                  const isLoading = meta?.loading || false;
                  const hasError = meta?.error;
                  const friendData = meta?.data;
                  const displayName = friendData?.username || friendId;
                  const isPreLoaded = friendData && !isLoading;
                  
                  return (
                    <div key={friendId} style={{ 
                      padding: '8px', 
                      backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'transparent',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      minHeight: '32px'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        flex: 1,
                        minWidth: 0 // Allow text truncation
                      }}>
                        {isLoading ? (
                          <>
                            <div 
                              style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid #f3f3f3',
                                borderTop: '2px solid #007bff',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                              }}
                              aria-label={`Loading friend ${friendId}`}
                            />
                            <span style={{ 
                              fontSize: '0.9em',
                              color: '#6c757d',
                              fontFamily: 'monospace'
                            }}>
                              {friendId}
                            </span>
                          </>
                        ) : hasError ? (
                          <>
                            <span 
                              style={{ 
                                color: '#dc3545',
                                fontSize: '1.1em',
                                cursor: 'help'
                              }}
                              title={`Error loading friend: ${hasError}`}
                              aria-label={`Error loading friend: ${hasError}`}
                            >
                              ⚠️
                            </span>
                            <span style={{ 
                              fontSize: '0.9em',
                              color: '#dc3545',
                              fontFamily: 'monospace'
                            }}>
                              {friendId}
                            </span>
                          </>
                        ) : (
                          <>
                            {isPreLoaded && (
                              <span 
                                style={{ 
                                  color: '#28a745',
                                  fontSize: '0.8em',
                                  cursor: 'help'
                                }}
                                title="Friend data pre-loaded for instant navigation"
                                aria-label="Pre-loaded"
                              >
                                ✓
                              </span>
                            )}
                            <span style={{ 
                              fontSize: '0.9em',
                              fontWeight: friendData ? 'normal' : 'normal',
                              color: friendData ? '#212529' : '#6c757d',
                              fontFamily: friendData ? 'inherit' : 'monospace'
                            }}>
                              {displayName}
                            </span>
                          </>
                        )}
                      </div>
                      
                      <button
                        onClick={() => handleViewFriend(friendId)}
                        disabled={isLoading || hasError}
                        style={{ 
                          color: (isLoading || hasError) ? '#6c757d' : '#007bff',
                          backgroundColor: 'transparent',
                          textDecoration: 'none', 
                          fontSize: '0.8em',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          border: `1px solid ${(isLoading || hasError) ? '#6c757d' : '#007bff'}`,
                          cursor: (isLoading || hasError) ? 'not-allowed' : 'pointer',
                          opacity: (isLoading || hasError) ? 0.6 : 1,
                          transition: 'all 0.2s ease'
                        }}
                        aria-label={`View ${displayName}'s profile`}
                      >
                        View
                      </button>
                    </div>
                  );
                })}
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
                          {queueLoading ? (
                            <AnalysisStatusBadge
                              status={{
                                state: 'none',
                                statusText: 'Loading...',
                                badgeColor: { background: '#f8f9fa', color: '#6c757d' }
                              }}
                              gameId={game.game_id}
                              isLoading={true}
                            />
                          ) : queueError ? (
                            <span style={{ 
                              color: '#dc3545',
                              fontSize: '0.8em',
                              padding: '2px 6px',
                              backgroundColor: '#f8d7da',
                              borderRadius: '3px'
                            }}>
                              Queue Error
                            </span>
                          ) : (
                            <AnalysisStatusBadge
                              status={getAnalysisStatus(game.game_id, game, analysisQueue)}
                              gameId={game.game_id}
                              isLoading={pendingOperations.has(game.game_id)}
                              onStartAnalysis={handleStartAnalysis}
                              onCancelAnalysis={handleCancelAnalysis}
                            />
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
