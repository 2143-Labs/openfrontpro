import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lobby } from '../types';
import { getPlayerTeams, formatPlayerTeams } from '../utils/teams';
import { getGameStatus, getTimeAgo } from '../utils';

const GameDetail: React.FC = () => {
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
        
        const response = await fetch(`/api/v1/games/${gameID}`);
        
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

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="game-detail">
        <button onClick={handleBack} className="back-button">
          ← Back
        </button>
        <h1>🎮 Game Detail</h1>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading game details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-detail">
        <button onClick={handleBack} className="back-button">
          ← Back
        </button>
        <h1>🎮 Game Detail</h1>
        <div style={{ textAlign: 'center', padding: '40px', color: '#dc3545' }}>
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-detail">
        <button onClick={handleBack} className="back-button">
          ← Back
        </button>
        <h1>🎮 Game Detail</h1>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Game not found.</p>
        </div>
      </div>
    );
  }

  const playerTeams = getPlayerTeams(game);
  const status = getGameStatus(game, 0);

  return (
    <div className="game-detail">
      <button onClick={handleBack} className="back-button">
        ← Back
      </button>
      <h1>Game {gameID}</h1>

      <div className="stats-sections">
        <section className="stats-section">
          <h2>Game Statistics</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div><strong>Map:</strong> {game.game_map}</div>
            <div><strong>Players:</strong> {game.approx_num_players}/{game.max_players}</div>
            <div><strong>Teams:</strong> {playerTeams ? formatPlayerTeams(playerTeams) : 'Unknown'}</div>
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

        <section className="stats-section">
          <h2>Player Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div><strong>First Seen:</strong> {getTimeAgo(game.first_seen_unix_sec)}</div>
            <div><strong>Last Seen:</strong> {getTimeAgo(game.last_seen_unix_sec)}</div>
            <div><strong>Completed:</strong> {game.completed ? 'Yes' : 'No'}</div>
            <div><strong>Analysis:</strong> {game.analysis_complete ? 'Complete' : 'Pending'}</div>
          </div>
        </section>

        <section className="stats-section">
          <h2>Team Details</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {playerTeams ? (
              <>
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
              </>
            ) : (
              <div>Team information not available</div>
            )}
          </div>
        </section>

        <section className="stats-section">
          <h2>Game Progress</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div><strong>Game ID:</strong> <code>{game.game_id}</code></div>
            <div><strong>Max Players:</strong> {game.max_players}</div>
            <div><strong>Current Players:</strong> ~{game.approx_num_players}</div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default GameDetail;
