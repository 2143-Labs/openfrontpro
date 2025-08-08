import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import { LobbyHome, GameDetail, UserDetail, Scoreboard } from './components';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LobbyHome />} />
      <Route path="/game/:gameID" element={<GameDetail />} />
      <Route path="/user/:userID" element={<UserDetail />} />
      <Route path="/scoreboard" element={<Scoreboard />} />
    </Routes>
  );
}

export default App;
