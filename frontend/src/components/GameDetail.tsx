import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lobby } from '../types';
import { getPlayerTeams, formatPlayerTeams } from '../utils/teams';
import { getGameStatus, getTimeAgo } from '../utils';
import GameAnalysis from './GameAnalysis';
import { getAllPlayers } from '../utils/charts';
import { GamePlayer } from '../types';
import SpawnLocationGrid from './SpawnLocationGrid';
import MapOverTime from './MapOverTime';
import { humansOnly } from '../utils/players';

// Static map dimensions data
const MAP_DIMENSIONS: Record<string, { width: number; height: number }> = {
  'Africa': { width: 1950, height: 2032 },
  'Asia': { width: 2000, height: 1200 },
  'Australia': { width: 2000, height: 1500 },
  'Baikal': { width: 2500, height: 1564 },
  'BetweenTwoSeas': { width: 1778, height: 1062 },
  'BlackSea': { width: 1500, height: 1100 },
  'Britannia': { width: 2000, height: 1396 },
  'Deglaciated Antarctica': { width: 2300, height: 1840 },
  'East Asia': { width: 1562, height: 1646 },
  'Europe': { width: 2350, height: 1674 },
  'Falkland Islands': { width: 2100, height: 1400 },
  'Faroe Islands': { width: 1600, height: 2000 },
  'GatewayToTheAtlantic': { width: 2216, height: 1968 },
  'Giant_World_Map': { width: 4110, height: 1948 },
  'Halkidiki': { width: 2200, height: 1760 },
  'Iceland': { width: 2000, height: 1500 },
  'Italia': { width: 1360, height: 1272 },
  'Mars': { width: 2000, height: 1000 },
  'MENA': { width: 2200, height: 964 },
  'NorthAmerica': { width: 2800, height: 1448 },
  'Oceania': { width: 2000, height: 1000 },
  'Pangaea': { width: 1000, height: 1000 },
  'Americas': { width: 1746, height: 2378 },
  'Strait of Gibraltar': { width: 2902, height: 1476 },
  'World': { width: 2000, height: 1000 }
};

function GameDetail() {
  const { gameID } = useParams<{ gameID: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [gameNotFound, setGameNotFound] = useState(false);
  const [mapDims, setMapDims] = useState<{width: number; height: number} | null>(null);
  const [spawnPlayers, setSpawnPlayers] = useState<GamePlayer[] | null>(null);
  const [spawnDataLoading, setSpawnDataLoading] = useState(false);
  const [spawnDataError, setSpawnDataError] = useState(false);

  const allPlayers = game?.info?.players ?? [];
  const humanPlayers = React.useMemo(() => humansOnly(allPlayers), [allPlayers]);

  useEffect(() => {
    const fetchGameDetails = async () => {
      if (!gameID) return;
      
      try {
        setLoading(true);
        setError(null);
        setGameNotFound(false);
        setGameCompleted(false);
        
        const response = await fetch(`/api/v1/games/${gameID}`);
        
        if (response.status === 404) {
          // Game not found = still in progress
          setGameNotFound(true);
          setGameCompleted(false);
          setError('Game is still in progress or does not exist.');
          return;
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch game details: ${response.status}`);
        }
        
        const gameData = await response.json();
        // If we successfully fetched game data, the game is completed
        setGameCompleted(true);
        setGameNotFound(false);
        setGame(gameData);
      } catch (err) {
        console.error('Error fetching game details:', err);
        if (err instanceof Error && err.message.includes('404')) {
          setGameNotFound(true);
          setGameCompleted(false);
          setError('Game is still in progress or does not exist.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to fetch game details');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchGameDetails();
  }, [gameID]);

  // Fetch map manifest and players when gameID or game map changes
  useEffect(() => {
    const fetchMapAndPlayers = async () => {
      if (!gameID || !game) {
        return;
      }
      
      try {
        setSpawnDataLoading(true);
        setSpawnDataError(false);
        
        // Get map dimensions from static lookup
        let mapFetchFailed = false;
        const mapName = game.info?.config?.gameMap || game.game_map;
        if (mapName && MAP_DIMENSIONS[mapName]) {
          setMapDims(MAP_DIMENSIONS[mapName]);
        } else {
          setMapDims(null);
          mapFetchFailed = true;
        }
        
        // Fetch players data
        const playersResponse = await fetch(`/api/v1/analysis/${gameID}/players`);
        let playersFetchFailed = false;
        if (playersResponse.ok) {
          const playersData = await playersResponse.json();
          if (playersData?.players && Array.isArray(playersData.players)) {
            const filteredSpawnPlayers = humansOnly(playersData.players);
            setSpawnPlayers(filteredSpawnPlayers);
          } else {
            setSpawnPlayers(null);
            playersFetchFailed = true;
          }
        } else {
          setSpawnPlayers(null);
          playersFetchFailed = true;
        }
        
        // Set error state if either fetch failed
        if (mapFetchFailed || playersFetchFailed) {
          setSpawnDataError(true);
        }
      } catch (err) {
        console.error('Error fetching map manifest or players:', err);
        setMapDims(null);
        setSpawnPlayers(null);
        setSpawnDataError(true);
      } finally {
        setSpawnDataLoading(false);
      }
    };

    fetchMapAndPlayers();
  }, [gameID, game?.info?.config?.gameMap, game?.game_map]);

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
  
  // Determine status based on API availability rather than game fields
  const getActualGameStatus = (): 'completed' | 'analyzed' | 'in-progress' => {
    if (gameNotFound) return 'in-progress';
    if (!gameCompleted) return 'in-progress';
    // If we have game data (gameCompleted = true), check for analysis
    if (game?.analysis_complete) return 'analyzed';
    return 'completed';
  };
  
  const status = getActualGameStatus();
  
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


  // Destructure winner tuple with graceful fallbacks
  const winnerInfo = game.info?.winner;
  let victoryLabel = '';
  let victoryValue: React.ReactNode = null;

  if (winnerInfo && Array.isArray(winnerInfo) && winnerInfo.length >= 2) {
    const victoryType = winnerInfo[0];   // "team" | "player"
    const primaryWinner = winnerInfo[1]; // team colour or clientID

    if (victoryType === 'team' && primaryWinner) {
      victoryLabel = 'Winning Team:';
      victoryValue =
        (<span className={`team-badge ${primaryWinner.toLowerCase()}`}>{primaryWinner}</span>);
    } else if (victoryType === 'player' && primaryWinner) {
      victoryLabel = 'Winner:';
      const p = game.info?.players?.find(pl => pl.clientID === primaryWinner);
      victoryValue = p ? p.username : primaryWinner || 'Unknown';
    }
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
                <div><strong>Bots:</strong> {game.info?.config?.bots}</div>
                <div><strong>Teams:</strong> {game.info?.config?.playerTeams}</div>
                <div><strong>NPCs:</strong> {game.info?.config?.disableNPCs ? '❌ Disabled' : '✅ Enabled'}</div>
                <div><strong>Infinite Gold:</strong> {game.info?.config?.infiniteGold ? '✅ Yes' : '❌ No'}</div>
                <div><strong>Infinite Troops:</strong> {game.info?.config?.infiniteTroops ? '✅ Yes' : '❌ No'}</div>
                <div><strong>Instant Build:</strong> {game.info?.config?.instantBuild ? '✅ Yes' : '❌ No'}</div>
                {game.info?.config?.disabledUnits && game.info.config.disabledUnits.length > 0 && (
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
                <div><strong>Duration:</strong> {formatDuration(game.info?.duration || 0)}</div>
                <div><strong>Total Turns:</strong> {formatNumber(game.info?.num_turns || 0)}</div>
                <div><strong>Started:</strong> {game.info?.start ? new Date(game.info.start).toLocaleString() : 'Unknown'}</div>
                <div><strong>Ended:</strong> {game.info?.end ? new Date(game.info.end).toLocaleString() : 'Unknown'}</div>
                <div><strong>Domain:</strong> {game.domain}</div>
                <div><strong>Subdomain:</strong> {game.subdomain}</div>
                <div><strong>Version:</strong> {game.version}</div>
              </div>
            </section>
          )}

          {/* Winner Information */}
          {game.info?.winner && Array.isArray(game.info.winner) && game.info.winner.length > 0 && (
            <section style={{
              backgroundColor: '#d4edda',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              border: '2px solid #c3e6cb'
            }}>
              <h2>🏆 Victory</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div><strong>Victory Type:</strong> {game.info?.winner?.[0] || 'Unknown'} victory</div>
                {winnerInfo && victoryLabel && victoryValue && (
                  <div><strong>{victoryLabel}</strong> {victoryValue}</div>
                )}
                {game.info.winner.length > 2 && (
                  <>
                    <div><strong>Winning Players:</strong></div>
                    <div style={{ marginLeft: '20px', fontSize: '0.9em' }}>
                      {game.info.winner.slice(2).map((playerId: string, index: number) => {
                        if (!playerId) return null;
                        const player = humanPlayers?.find((p: any) => p.clientID === playerId);
                        return (
                          <div key={playerId || index} style={{ marginBottom: '4px' }}>
                            • {player?.username || playerId || 'Unknown Player'}
                          </div>
                        );
                      }).filter(Boolean)}
                    </div>
                  </>
                )}
                {game.info.winner.length <= 2 && (
                  <div style={{ fontSize: '0.9em', color: '#666' }}>No additional player information available.</div>
                )}
              </div>
            </section>
          )}

          {/* All Players by Gold */}
          {humanPlayers && humanPlayers.length > 0 && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>💰 All Players by Gold</h2>
              <div className="player-ranking-container">
                {getAllPlayers(humanPlayers, 'gold').map((player, index) => {
                  const goldValue = Array.isArray(player.stats.gold) ? player.stats.gold[0] : player.stats.gold;
                  const itemClass = index === 0 ? 'player-ranking-item first-place' : 
                                   index % 2 === 0 ? 'player-ranking-item even' : 'player-ranking-item odd';
                  return (
                    <div key={player.clientID} className={itemClass}>
                      <span>{index + 1}. {player.username}</span>
                      <span style={{ fontWeight: 'bold' }}>{formatNumber(goldValue)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Player Count Summary */}
          {humanPlayers && humanPlayers.length > 0 && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>👥 Player Overview</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div><strong>Total Players:</strong> {humanPlayers.length}</div>
                <div><strong>Active Players:</strong> {humanPlayers.filter((p: any) => p.stats).length}</div>
                <div><strong>Players with Combat:</strong> {humanPlayers.filter((p: any) => p.stats?.attacks).length}</div>
                <div><strong>Players with Betrayals:</strong> {humanPlayers.filter((p: any) => p.stats?.betrayals).length}</div>
                <div><strong>Players with Nuclear Weapons:</strong> {humanPlayers.filter((p: any) => p.stats?.bombs).length}</div>
              </div>
            </section>
          )}

          {/* Battle Statistics */}
          {humanPlayers && getAllPlayers(humanPlayers, 'attacks').length > 0 && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>⚔️ All Combat Players</h2>
              <div className="player-ranking-container">
                {getAllPlayers(humanPlayers, 'attacks').map((player, index) => {
                  const attackValue = Array.isArray(player.stats.attacks) ? player.stats.attacks[0] : player.stats.attacks;
                  const itemClass = index === 0 ? 'player-ranking-item combat-first' : 
                                   index % 2 === 0 ? 'player-ranking-item even' : 'player-ranking-item odd';
                  return (
                    <div key={player.clientID} className={itemClass}>
                      <span>{index + 1}. {player.username}</span>
                      <span style={{ fontWeight: 'bold' }}>{formatNumber(attackValue)} attacks</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

{/* Nuclear Warfare Statistics */}
          {humanPlayers && humanPlayers.some((p: any) => p.stats?.bombs) && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>☢️ All Nuclear Warfare</h2>
              <div className="player-ranking-container">
                {humanPlayers
                  .filter((p: any) => p.stats?.bombs)
                  .sort((a: any, b: any) => {
                    const aTotal = (a.stats.bombs.abomb?.[0] ? parseInt(a.stats.bombs.abomb[0]) : 0) + 
                                   (a.stats.bombs.hbomb?.[0] ? parseInt(a.stats.bombs.hbomb[0]) : 0);
                    const bTotal = (b.stats.bombs.abomb?.[0] ? parseInt(b.stats.bombs.abomb[0]) : 0) + 
                                   (b.stats.bombs.hbomb?.[0] ? parseInt(b.stats.bombs.hbomb[0]) : 0);
                    return bTotal - aTotal;
                  })
                  .map((player: any, index: number) => {
                    const abombs = player.stats.bombs.abomb?.[0] ? parseInt(player.stats.bombs.abomb[0]) : 0;
                    const hbombs = player.stats.bombs.hbomb?.[0] ? parseInt(player.stats.bombs.hbomb[0]) : 0;
                    const itemClass = index === 0 ? 'player-ranking-item first-place' : 
                                     index % 2 === 0 ? 'player-ranking-item even' : 'player-ranking-item odd';
                    return (
                      <div key={player.clientID} className={itemClass}>
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

          {/* Player Spawn Locations */}
          <section className="stats-section">
            <h2>Player Spawn Locations</h2>
            {spawnDataLoading ? (
              <p style={{textAlign:'center'}}>Loading spawn data...</p>
            ) : spawnDataError ? (
              <p style={{textAlign:'center'}}>Error loading spawn data.</p>
            ) : (!mapDims || !spawnPlayers) ? (
              <p style={{textAlign:'center'}}>Spawn data not available.</p>
            ) : (
              <SpawnLocationGrid 
                mapWidth={mapDims.width}
                mapHeight={mapDims.height}
                players={spawnPlayers}
                maxRenderWidth={400}
              />
            )}
          </section>

          {/* Map Over Time */}
          {gameCompleted && mapDims && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              gridColumn: 'span 2' // Take up more space for the interactive map
            }}>
              <h2>🗺️ Map Over Time</h2>
              <p style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>
                Watch construction events unfold over the course of the game. Use the slider or play button to see how players built their empires.
              </p>
              <MapOverTime
                gameId={gameID!}
                players={spawnPlayers}
                mapWidth={mapDims.width}
                mapHeight={mapDims.height}
                maxRenderWidth={500}
              />
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
        {gameCompleted && (
          <GameAnalysis gameId={gameID!} players={spawnPlayers} />
        )}
        
        {!gameCompleted && (
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
