import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lobby } from '../types';
import { getPlayerTeams, formatPlayerTeams } from '../utils/teams';
import { getGameStatus, getTimeAgo } from '../utils';
import GameAnalysis from './GameAnalysis';

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
  
  // Helper functions for displaying game data
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatNumber = (num: string | number) => {
    return typeof num === 'string' ? parseInt(num).toLocaleString() : num.toLocaleString();
  };

  const getTopPlayers = (players: any[], metric: string) => {
    return players
      .filter(p => p.stats && p.stats[metric])
      .sort((a, b) => {
        const aValue = Array.isArray(a.stats[metric]) ? parseInt(a.stats[metric][0]) : parseInt(a.stats[metric]);
        const bValue = Array.isArray(b.stats[metric]) ? parseInt(b.stats[metric][0]) : parseInt(b.stats[metric]);
        return bValue - aValue;
      })
      .slice(0, 3);
  };

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
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '20px',
          padding: '20px'
        }}>
          {/* Basic Game Information */}
          <section style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h2>🎮 Game Overview</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><strong>Map:</strong> {game.info?.config?.gameMap || game.game_map}</div>
              <div><strong>Game Mode:</strong> {game.info?.config?.gameMode || 'Unknown'}</div>
              <div><strong>Game Type:</strong> {game.info?.config?.gameType || 'Unknown'}</div>
              <div><strong>Players:</strong> {game.info?.players?.length || game.approx_num_players}/{game.info?.config?.maxPlayers || game.max_players}</div>
              <div><strong>Difficulty:</strong> {game.info?.config?.difficulty || 'Unknown'}</div>
              <div><strong>Status:</strong> 
                <span style={{
                  marginLeft: '8px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.8em',
                  fontWeight: 'bold',
                  backgroundColor: 
                    status === 'analyzed' ? '#d1ecf1' :
                    status === 'completed' ? '#d4edda' :
                    '#fff3cd',
                  color: 
                    status === 'analyzed' ? '#0c5460' :
                    status === 'completed' ? '#155724' :
                    '#856404'
                }}>
                  {status.toUpperCase()}
                </span>
              </div>
            </div>
          </section>

          {/* Game Configuration */}
          {game.info?.config && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>⚙️ Game Settings</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div><strong>Bots:</strong> {game.info.config.bots}</div>
                <div><strong>Teams:</strong> {game.info.config.playerTeams}</div>
                <div><strong>NPCs:</strong> {game.info.config.disableNPCs ? '❌ Disabled' : '✅ Enabled'}</div>
                <div><strong>Infinite Gold:</strong> {game.info.config.infiniteGold ? '✅ Yes' : '❌ No'}</div>
                <div><strong>Infinite Troops:</strong> {game.info.config.infiniteTroops ? '✅ Yes' : '❌ No'}</div>
                <div><strong>Instant Build:</strong> {game.info.config.instantBuild ? '✅ Yes' : '❌ No'}</div>
                {game.info.config.disabledUnits && game.info.config.disabledUnits.length > 0 && (
                  <div><strong>Disabled Units:</strong> {game.info.config.disabledUnits.join(', ')}</div>
                )}
              </div>
            </section>
          )}

          {/* Game Duration & Stats */}
          {game.info && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>📊 Game Statistics</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div><strong>Duration:</strong> {formatDuration(game.info.duration)}</div>
                <div><strong>Total Turns:</strong> {formatNumber(game.info.num_turns)}</div>
                <div><strong>Started:</strong> {new Date(game.info.start).toLocaleString()}</div>
                <div><strong>Ended:</strong> {new Date(game.info.end).toLocaleString()}</div>
                <div><strong>Domain:</strong> {game.domain}</div>
                <div><strong>Subdomain:</strong> {game.subdomain}</div>
                <div><strong>Version:</strong> {game.version}</div>
              </div>
            </section>
          )}

          {/* Winner Information */}
          {game.info?.winner && (
            <section style={{
              backgroundColor: '#d4edda',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              border: '2px solid #c3e6cb'
            }}>
              <h2>🏆 Victory</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div><strong>Victory Type:</strong> {game.info.winner[0]} victory</div>
                <div><strong>Winning Team:</strong> <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: game.info.winner[1].toLowerCase(),
                  color: 'white',
                  fontWeight: 'bold'
                }}>{game.info.winner[1]}</span></div>
                <div><strong>Winning Players:</strong></div>
                <div style={{ marginLeft: '20px', fontSize: '0.9em' }}>
                  {game.info.winner.slice(2).map((playerId: string, index: number) => {
                    const player = game.info.players.find((p: any) => p.clientID === playerId);
                    return (
                      <div key={playerId} style={{ marginBottom: '4px' }}>
                        • {player?.username || playerId}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Top Players by Gold */}
          {game.info?.players && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>💰 Top Players by Gold</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {getTopPlayers(game.info.players, 'gold').map((player, index) => {
                  const goldValue = Array.isArray(player.stats.gold) ? player.stats.gold[0] : player.stats.gold;
                  return (
                    <div key={player.clientID} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      padding: '8px',
                      backgroundColor: index === 0 ? '#fff3cd' : 'transparent',
                      borderRadius: '4px'
                    }}>
                      <span>{index + 1}. {player.username}</span>
                      <span style={{ fontWeight: 'bold' }}>{formatNumber(goldValue)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Player Count Summary */}
          {game.info?.players && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>👥 Player Overview</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div><strong>Total Players:</strong> {game.info.players.length}</div>
                <div><strong>Active Players:</strong> {game.info.players.filter((p: any) => p.stats).length}</div>
                <div><strong>Players with Combat:</strong> {game.info.players.filter((p: any) => p.stats?.attacks).length}</div>
                <div><strong>Players with Betrayals:</strong> {game.info.players.filter((p: any) => p.stats?.betrayals).length}</div>
                <div><strong>Players with Nuclear Weapons:</strong> {game.info.players.filter((p: any) => p.stats?.bombs).length}</div>
              </div>
            </section>
          )}

          {/* Battle Statistics */}
          {game.info?.players && getTopPlayers(game.info.players, 'attacks').length > 0 && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>⚔️ Top Combat Players</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {getTopPlayers(game.info.players, 'attacks').map((player, index) => {
                  const attackValue = Array.isArray(player.stats.attacks) ? player.stats.attacks[0] : player.stats.attacks;
                  return (
                    <div key={player.clientID} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      padding: '8px',
                      backgroundColor: index === 0 ? '#f8d7da' : 'transparent',
                      borderRadius: '4px'
                    }}>
                      <span>{index + 1}. {player.username}</span>
                      <span style={{ fontWeight: 'bold' }}>{formatNumber(attackValue)} attacks</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Nuclear Warfare Statistics */}
          {game.info?.players && game.info.players.some((p: any) => p.stats?.bombs) && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>☢️ Nuclear Warfare</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {game.info.players
                  .filter((p: any) => p.stats?.bombs)
                  .sort((a: any, b: any) => {
                    const aTotal = (a.stats.bombs.abomb?.[0] ? parseInt(a.stats.bombs.abomb[0]) : 0) + 
                                   (a.stats.bombs.hbomb?.[0] ? parseInt(a.stats.bombs.hbomb[0]) : 0);
                    const bTotal = (b.stats.bombs.abomb?.[0] ? parseInt(b.stats.bombs.abomb[0]) : 0) + 
                                   (b.stats.bombs.hbomb?.[0] ? parseInt(b.stats.bombs.hbomb[0]) : 0);
                    return bTotal - aTotal;
                  })
                  .slice(0, 5)
                  .map((player: any, index: number) => {
                    const abombs = player.stats.bombs.abomb?.[0] ? parseInt(player.stats.bombs.abomb[0]) : 0;
                    const hbombs = player.stats.bombs.hbomb?.[0] ? parseInt(player.stats.bombs.hbomb[0]) : 0;
                    return (
                      <div key={player.clientID} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '8px',
                        backgroundColor: index === 0 ? '#fff3cd' : 'transparent',
                        borderRadius: '4px'
                      }}>
                        <span>{index + 1}. {player.username}</span>
                        <span style={{ fontWeight: 'bold' }}>
                          {abombs > 0 && `${abombs} A-bombs`}
                          {abombs > 0 && hbombs > 0 && ', '}
                          {hbombs > 0 && `${hbombs} H-bombs`}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Team Structure Details */}
          <section style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h2>🤝 Team Structure</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><strong>Team Format:</strong> {formatPlayerTeams(playerTeams)}</div>
              {playerTeams.group === 'Teams' && (
                <div><strong>Number of Teams:</strong> {playerTeams.num_teams}</div>
              )}
              {playerTeams.group === 'Parties' && (
                <div><strong>Party Size:</strong> {playerTeams.party_size}</div>
              )}
              {playerTeams.group === 'FFA' && (
                <div><strong>Game Mode:</strong> Free for All (no teams)</div>
              )}
              {game.info?.config?.playerTeams && (
                <div><strong>Configured Teams:</strong> {game.info.config.playerTeams}</div>
              )}
            </div>
          </section>
        </div>
        
        {/* Game Analysis Section */}
        {game.completed && game.analysis_complete && (
          <GameAnalysis gameId={gameID!} />
        )}
        
        {game.completed && !game.analysis_complete && (
          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff3cd', margin: '20px', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: '#856404' }}>
              📊 This game is completed but analysis is not yet available. Analysis may take a few minutes to process.
            </p>
          </div>
        )}
        
        {!game.completed && (
          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#d1ecf1', margin: '20px', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: '#0c5460' }}>
              🎮 This game is still in progress. Analysis will be available once the game is completed.
            </p>
          </div>
        )}
      </main>
      
      <footer className="App-footer">
        <p>&copy; 2024 OpenFront.Pro. Connect and play together!</p>
      </footer>
    </div>
  );
}

export default GameDetail;
