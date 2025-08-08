import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserSummary } from '../types';
import { fetchAllUsers } from '../services/api';
import { LoadingSpinner, ErrorMessage } from './';

const Scoreboard: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const userData = await fetchAllUsers();
        setUsers(userData);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

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
              <h1>Scoreboard</h1>
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
              <h1>Scoreboard</h1>
            </div>
            <ErrorMessage message={error} />
          </div>
        </main>
      </div>
    );
  }

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
            <h1>Scoreboard</h1>
          </div>
          
          {users.length === 0 ? (
            <div className="empty-state">
              <p>No users found.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="scoreboard-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th className="center">Tracked?</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.user_id}>
                      <td>
                        <Link 
                          to={`/user/${user.user_id}`}
                          className="user-link"
                        >
                          {user.username}
                        </Link>
                      </td>
                      <td className="center">
                        {user.is_tracked ? '✅' : '❌'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      
      <footer className="App-footer">
        <p>&copy; 2024 OpenFront.Pro. Connect and play together!</p>
      </footer>
    </div>
  );
};

export default Scoreboard;
