import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function UserDetail() {
  const { userID } = useParams<{ userID: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!userID) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/v1/users/${userID}`);
        
        if (response.status === 404) {
          setError('User not found.');
          return;
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch user details: ${response.status}`);
        }
        
        const userData = await response.json();
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
            <h1>User Detail</h1>
          </div>
        </header>
        <main className="App-main">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading user details...</p>
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
            <h1>User Detail</h1>
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

  if (!user) {
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
            <h1>User Detail</h1>
          </div>
        </header>
        <main className="App-main">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>User not found.</p>
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
              <div><strong>User ID:</strong> {user.id || userID}</div>
              <div><strong>Status:</strong> {user.status || 'Unknown'}</div>
              {user.email && <div><strong>Email:</strong> {user.email}</div>}
              {user.joinDate && <div><strong>Joined:</strong> {new Date(user.joinDate).toLocaleDateString()}</div>}
            </div>
          </section>

          {/* User Statistics */}
          {user.stats && (
            <section style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2>📊 Statistics</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {user.stats.gamesPlayed && <div><strong>Games Played:</strong> {user.stats.gamesPlayed}</div>}
                {user.stats.gamesWon && <div><strong>Games Won:</strong> {user.stats.gamesWon}</div>}
                {user.stats.winRate && <div><strong>Win Rate:</strong> {(user.stats.winRate * 100).toFixed(1)}%</div>}
                {user.stats.totalPlayTime && <div><strong>Total Play Time:</strong> {user.stats.totalPlayTime}</div>}
              </div>
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
