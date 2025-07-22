import React from 'react';
import { useLobbies } from '../hooks/useLobbies';
import { FilterControls, SortControls, LobbiesTable, LoadingSpinner, ErrorMessage } from './';

function LobbyHome() {
  const {
    lobbies,
    loading,
    error,
    completedFilter,
    setCompletedFilter,
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

  return (
    <div className="App">
      <header className="App-header">
        <div className="wip-banner">
          🚧 This site is a work in progress 🚧
        </div>
        <h1>openfront.pro</h1>
        <p>Match replay analysis for OpenFront</p>
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
        <section className="lobbies-section">
          <h2>Available Lobbies</h2>
          
          <FilterControls
            completedFilter={completedFilter}
            setCompletedFilter={setCompletedFilter}
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
