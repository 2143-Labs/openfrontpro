import { describe, it, expect } from 'vitest';
import { getPlayerTeams, formatPlayerTeams } from './teams';
import { Lobby, PlayerTeams } from '../types';

describe('getPlayerTeams', () => {
  it('should return FFA when teams field is null', () => {
    const lobby: Lobby = {
      game_id: 'test1',
      teams: null,
      max_players: 8,
      game_map: 'TestMap',
      approx_num_players: 4,
      first_seen_unix_sec: 1234567890,
      last_seen_unix_sec: 1234567900,
      completed: false,
      analysis_complete: false
    };
    
    const result = getPlayerTeams(lobby);
    expect(result).toEqual({ group: 'FFA' });
  });

  it('should return FFA when teams field is undefined', () => {
    const lobby: Lobby = {
      game_id: 'test2',
      teams: undefined,
      max_players: 8,
      game_map: 'TestMap',
      approx_num_players: 4,
      first_seen_unix_sec: 1234567890,
      last_seen_unix_sec: 1234567900,
      completed: false,
      analysis_complete: false
    };
    
    const result = getPlayerTeams(lobby);
    expect(result).toEqual({ group: 'FFA' });
  });

  it('should handle Teams format', () => {
    const lobby: Lobby = {
      game_id: 'test3',
      teams: { group: 'Teams', num_teams: 4 },
      max_players: 8,
      game_map: 'TestMap',
      approx_num_players: 6,
      first_seen_unix_sec: 1234567890,
      last_seen_unix_sec: 1234567900,
      completed: false,
      analysis_complete: false
    };
    
    const result = getPlayerTeams(lobby);
    expect(result).toEqual({ group: 'Teams', num_teams: 4 });
  });

  it('should return structured PlayerTeams when teams field is structured', () => {
    const playerTeams: PlayerTeams = { group: 'Teams', num_teams: 3 };
    const lobby: Lobby = {
      game_id: 'test4',
      teams: playerTeams,
      max_players: 12,
      game_map: 'TestMap',
      approx_num_players: 9,
      first_seen_unix_sec: 1234567890,
      last_seen_unix_sec: 1234567900,
      completed: false,
      analysis_complete: false
    };
    
    const result = getPlayerTeams(lobby);
    expect(result).toEqual(playerTeams);
  });


  it('should handle FFA structured format', () => {
    const playerTeams: PlayerTeams = { group: 'FFA' };
    const lobby: Lobby = {
      game_id: 'test7',
      teams: playerTeams,
      max_players: 8,
      game_map: 'TestMap',
      approx_num_players: 5,
      first_seen_unix_sec: 1234567890,
      last_seen_unix_sec: 1234567900,
      completed: false,
      analysis_complete: false
    };
    
    const result = getPlayerTeams(lobby);
    expect(result).toEqual(playerTeams);
  });

  it('should handle Parties structured format', () => {
    const playerTeams: PlayerTeams = { group: 'Parties', party_size: 3 };
    const lobby: Lobby = {
      game_id: 'test8',
      teams: playerTeams,
      max_players: 12,
      game_map: 'TestMap',
      approx_num_players: 9,
      first_seen_unix_sec: 1234567890,
      last_seen_unix_sec: 1234567900,
      completed: false,
      analysis_complete: false
    };
    
    const result = getPlayerTeams(lobby);
    expect(result).toEqual(playerTeams);
  });
});

describe('formatPlayerTeams', () => {
  it('should format FFA correctly', () => {
    const playerTeams: PlayerTeams = { group: 'FFA' };
    const result = formatPlayerTeams(playerTeams);
    expect(result).toBe('FFA');
  });

  it('should format Teams correctly', () => {
    const playerTeams: PlayerTeams = { group: 'Teams', num_teams: 4 };
    const result = formatPlayerTeams(playerTeams);
    expect(result).toBe('4 Teams');
  });

  it('should format single Team correctly', () => {
    const playerTeams: PlayerTeams = { group: 'Teams', num_teams: 1 };
    const result = formatPlayerTeams(playerTeams);
    expect(result).toBe('1 Teams');
  });

  it('should format Parties correctly', () => {
    const playerTeams: PlayerTeams = { group: 'Parties', party_size: 2 };
    const result = formatPlayerTeams(playerTeams);
    expect(result).toBe('Parties (2)');
  });

  it('should format large party size correctly', () => {
    const playerTeams: PlayerTeams = { group: 'Parties', party_size: 8 };
    const result = formatPlayerTeams(playerTeams);
    expect(result).toBe('Parties (8)');
  });
});

describe('Integration tests - getPlayerTeams + formatPlayerTeams', () => {
  it('should handle structured teams format end-to-end', () => {
    const lobby: Lobby = {
      game_id: 'integration1',
      teams: { group: 'Teams', num_teams: 3 },
      max_players: 9,
      game_map: 'IntegrationMap',
      approx_num_players: 7,
      first_seen_unix_sec: 1234567890,
      last_seen_unix_sec: 1234567900,
      completed: false,
      analysis_complete: false
    };
    
    const playerTeams = getPlayerTeams(lobby);
    const formatted = formatPlayerTeams(playerTeams!);
    expect(formatted).toBe('3 Teams');
  });

  it('should handle null teams end-to-end', () => {
    const lobby: Lobby = {
      game_id: 'integration2',
      teams: null,
      max_players: 16,
      game_map: 'IntegrationMap',
      approx_num_players: 12,
      first_seen_unix_sec: 1234567890,
      last_seen_unix_sec: 1234567900,
      completed: false,
      analysis_complete: false
    };
    
    const playerTeams = getPlayerTeams(lobby);
    const formatted = formatPlayerTeams(playerTeams!);
    expect(formatted).toBe('FFA');
  });

  it('should handle structured parties format end-to-end', () => {
    const lobby: Lobby = {
      game_id: 'integration3',
      teams: { group: 'Parties', party_size: 4 },
      max_players: 16,
      game_map: 'IntegrationMap',
      approx_num_players: 12,
      first_seen_unix_sec: 1234567890,
      last_seen_unix_sec: 1234567900,
      completed: false,
      analysis_complete: false
    };
    
    const playerTeams = getPlayerTeams(lobby);
    const formatted = formatPlayerTeams(playerTeams!);
    expect(formatted).toBe('Parties (4)');
  });
});
