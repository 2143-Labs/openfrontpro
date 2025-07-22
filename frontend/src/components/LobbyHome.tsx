import React, { useState } from 'react';
import { useLobbies } from '../hooks/useLobbies';
import { FilterControls, SortControls, LobbiesTable, LoadingSpinner, ErrorMessage } from './';

function LobbyHome() {
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
      const response = await fetch(`/api/v1/games/${gameId}/analyze`, {
        method: 'POST'
      });

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

  return (
    <div className="App">
      <header className="App-header">
        <div className="wip-banner">
          🚧 This site is a work in progress 🚧
        </div>
        <h1>openfront.pro</h1>
        <p>Match replay analysis for OpenFront</p>
        
        <div style={{ marginBottom: '1rem' }}>
          <a
            href="/oauth/discord/login"
            className="discord-login-btn"
            role="button"
          >
            🎮 Login with Discord
          </a>
        </div>
        
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
        <a
          href="https://openfront.io"
          target="_blank"
          rel="noopener noreferrer"
          className="origin-btn"
        >
          ▶️ Play the original game
        </a>
      </header>
      
      <main className="App-main">
        <section className="analysis-section">
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
