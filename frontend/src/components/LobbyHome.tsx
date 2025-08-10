import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbies } from '../hooks/useLobbies';
import { FilterControls, SortControls, LobbiesTable, LoadingSpinner, ErrorMessage, AnalysisQueue } from './';
import { markGameForAnalysis } from '../services/api';

// Utility function to get cookie value
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

// Utility function to delete cookie
const deleteCookie = (name: string) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

function LobbyHome() {
  const navigate = useNavigate();
  const {
    lobbies,
    loading,
    error,
    completedFilter,
    setCompletedFilter,
    hasAnalysisFilter,
    setHasAnalysisFilter,
    afterFilter,
    setAfterFilter,
    mapFilter,
    setMapFilter,
    teamFilter,
    setTeamFilter,
    sortBy,
    setSortBy,
    getFilteredAndSortedLobbies,
    refreshLobbies
  } = useLobbies();

  // Single game analysis state
  const [gameId, setGameId] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisSuccess, setAnalysisSuccess] = useState('');

  const handleAnalyzeGame = async () => {
    if (!gameId.trim()) {
      setAnalysisError('Please enter a game ID');
      return;
    }

    if (gameId.length !== 8) {
      setAnalysisError('Game ID must be exactly 8 characters');
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError('');
    setAnalysisSuccess('');

    try {
      const response = await markGameForAnalysis(gameId);
      if (!response.ok) {
        throw new Error(`Failed to analyze game: ${response.statusText}`);
      }
      setAnalysisSuccess(`Analysis requested for game ${gameId}`);
      setGameId(''); // Clear the input on success
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze game');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleGameIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 8); // Limit to 8 characters
    setGameId(value);
    setAnalysisError('');
    setAnalysisSuccess('');
  };

const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status
  const checkAuthStatus = () => {
    const sessionToken = getCookie('session_token');
    const isAuth = Boolean(sessionToken);
    setIsAuthenticated(isAuth);
    return isAuth;
  };

  useEffect(() => {
    // Initial auth check
    checkAuthStatus();
  }, []);

  // Optional: Reactive cookie change detection for cross-tab sync
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    // Check auth status when tab becomes visible (user switches back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAuthStatus();
      }
    };

    // Periodic check as fallback (every 30 seconds when tab is active)
    const startPeriodicCheck = () => {
      intervalId = setInterval(() => {
        if (!document.hidden) {
          checkAuthStatus();
        }
      }, 30000); // 30 seconds
    };

    // Set up listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPeriodicCheck();

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const handleLogout = () => {
    deleteCookie('session_token');
    setIsAuthenticated(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="wip-banner">
          🚧 This site is a work in progress 🚧
        </div>
        <h1>openfront.pro</h1>
        <p>Match replay analysis for OpenFront</p>
      </header>
      
      <main className="App-main">
        <section className="analysis-section">
          <div className="analysis-wrapper">
            <AnalysisQueue />
            <div className="analysis-left">
              <h2>Analyze Single Game</h2>
              <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                Enter a game ID (8 characters) to request analysis
              </p>
              
              <div className="game-analysis-form">
                <div className="input-group">
                  <input
                    type="text"
                    value={gameId}
                    onChange={handleGameIdChange}
                    placeholder="e.g., DNXzJrw9"
                    maxLength={8}
                    className="game-id-input"
                    disabled={analysisLoading}
                  />
                  <button
                    onClick={handleAnalyzeGame}
                    disabled={analysisLoading || gameId.length !== 8}
                    className="analyze-btn"
                  >
                    {analysisLoading ? '🔄 Analyzing...' : '🔍 Request Analysis'}
                  </button>
                </div>
                
                {analysisError && (
                  <div className="analysis-message error-message">
                    ❌ {analysisError}
                  </div>
                )}
                
                {analysisSuccess && (
                  <div className="analysis-message success-message">
                    ✅ {analysisSuccess}
                  </div>
                )}
              </div>
            </div>
            <div className="analysis-right">
              {isAuthenticated ? (
                <div>
                  <div className="logged-in-message">
                    🎉 You are logged in!
                  </div>
                  <button className="set-openfront-id-btn">
                    🔗 Set Openfront ID
                  </button>
                  <button
                    onClick={handleLogout}
                    className="logout-btn"
                  >
                    🚪 Logout
                  </button>
                </div>
              ) : (
                <a
                  href="/oauth/discord/login"
                  className="discord-login-btn"
                  role="button"
                >
                  🎮 Login with Discord
                </a>
              )}
              
              <div style={{ marginTop: '1rem' }}>
                <button 
                  onClick={refreshLobbies}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: loading ? '#6c757d' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh Lobbies'}
                </button>
              </div>
              <button
                onClick={() => navigate('/scoreboard')}
                className="scoreboard-btn"
              >
                🏆 Scoreboard
              </button>
              <a
                href="https://openfront.io"
                target="_blank"
                rel="noopener noreferrer"
                className="origin-btn"
              >
                ▶️ Play the original game
              </a>
            </div>
          </div>
        </section>
        
        <section className="lobbies-section">
          <h2>Available Lobbies</h2>
          
          <FilterControls
            completedFilter={completedFilter}
            setCompletedFilter={setCompletedFilter}
            hasAnalysisFilter={hasAnalysisFilter}
            setHasAnalysisFilter={setHasAnalysisFilter}
            afterFilter={afterFilter}
            setAfterFilter={setAfterFilter}
            mapFilter={mapFilter}
            setMapFilter={setMapFilter}
            teamFilter={teamFilter}
            setTeamFilter={setTeamFilter}
            lobbies={lobbies}
          />
          
          {!loading && !error && lobbies.length > 0 && (
            <SortControls
              sortBy={sortBy}
              setSortBy={setSortBy}
            />
          )}
          
          {loading && <LoadingSpinner />}
          {error && <ErrorMessage message={error} />}
          {!loading && !error && <LobbiesTable lobbies={getFilteredAndSortedLobbies()} />}
          
          {!loading && !error && lobbies.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <p style={{ color: '#666' }}>
                Showing {getFilteredAndSortedLobbies().length} of {lobbies.length} {lobbies.length === 1 ? 'lobby' : 'lobbies'}
              </p>
            </div>
          )}
        </section>
      </main>
      
      <footer className="App-footer">
        <p>&copy; 2024 OpenFront.Pro. Connect and play together!</p>
      </footer>
    </div>
  );
}

export default LobbyHome;
