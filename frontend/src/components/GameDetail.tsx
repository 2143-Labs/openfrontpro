import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lobby } from '../types';
import { getPlayerTeams, formatPlayerTeams } from '../utils/teams';
import { getGameStatus, getTimeAgo } from '../utils';

function GameDetail() {
  const { gameID } = useParams<{ gameID: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameDetails = async () => {
      if (!gameID) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/v1/game/${gameID}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch game details: ${response.status}`);
        }
        
        const gameData = await response.json();
        setGame(gameData);
      } catch (err) {
        console.error('Error fetching game details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch game details');
      } finally {
        setLoading(false);
      }
    };

    fetchGameDetails();
  }, [gameID]);

  const handleBackToLobbies = () => {
    navigate('/');
  };

  if (loading) {
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
                fontSize: '14px'
              }}
            >
              ← Back to Lobbies
            </button>
            <h1>Game Detail</h1>
          </div>
        </header>
        <main className="App-main">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading game details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
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
                fontSize: '14px'
              }}
            >
              ← Back to Lobbies
            </button>
            <h1>Game Detail</h1>
          </div>
        </header>
        <main className="App-main">
          <div style={{ textAlign: 'center', padding: '40px', color: '#dc3545' }}>
            <p>Error: {error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!game) {
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
                fontSize: '14px'
              }}
            >
              ← Back to Lobbies
            </button>
            <h1>Game Detail</h1>
          </div>
        </header>
        <main className="App-main">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Game not found.</p>
          </div>
        </main>
      </div>
    );
  }

  const playerTeams = game.teams || { group: 'FFA' }; // Default to FFA if null
  const status = getGameStatus(game, 0);

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
            <h1>Game Detail</h1>
            <p>Game ID: <strong style={{ fontFamily: 'monospace' }}>{gameID}</strong></p>
          </div>
        </div>
      </header>
      
      <main className="App-main">
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '20px',
          padding: '20px'
        }}>
          <section style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h2>Game Information</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><strong>Map:</strong> {game.game_map}</div>
              <div><strong>Players:</strong> {game.approx_num_players}/{game.max_players}</div>
              <div><strong>Teams:</strong> {formatPlayerTeams(playerTeams)}</div>
              <div><strong>Status:</strong> 
                <span style={{
                  marginLeft: '8px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.8em',
                  fontWeight: 'bold',
                  backgroundColor: 
                    status === 'active' ? '#d4edda' :
                    status === 'in-progress' ? '#fff3cd' :
                    status === 'full' ? '#ffeaa7' :
                    '#f8d7da',
                  color: 
                    status === 'active' ? '#155724' :
                    status === 'in-progress' ? '#856404' :
                    status === 'full' ? '#b8860b' :
                    '#721c24'
                }}>
                  {status.toUpperCase()}
                </span>
              </div>
            </div>
          </section>

          <section style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h2>Timeline</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><strong>First Seen:</strong> {getTimeAgo(game.first_seen_unix_sec)}</div>
              <div><strong>Last Seen:</strong> {getTimeAgo(game.last_seen_unix_sec)}</div>
              <div><strong>Completed:</strong> {game.completed ? 'Yes' : 'No'}</div>
              <div><strong>Analysis:</strong> {game.analysis_complete ? 'Complete' : 'Pending'}</div>
            </div>
          </section>

          <section style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h2>Team Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><strong>Team Structure:</strong> {formatPlayerTeams(playerTeams)}</div>
              {playerTeams.group === 'Teams' && (
                <div><strong>Number of Teams:</strong> {playerTeams.num_teams}</div>
              )}
              {playerTeams.group === 'Parties' && (
                <div><strong>Party Size:</strong> {playerTeams.party_size}</div>
              )}
              {playerTeams.group === 'FFA' && (
                <div><strong>Game Mode:</strong> Free for All (no teams)</div>
              )}
            </div>
          </section>
        </div>
      </main>
      
      <footer className="App-footer">
        <p>&copy; 2024 OpenFront.Pro. Connect and play together!</p>
      </footer>
    </div>
  );
}

export default GameDetail;
