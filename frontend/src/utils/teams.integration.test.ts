import { describe, it, expect } from 'vitest';
import { getPlayerTeams, formatPlayerTeams } from './teams';
import { Lobby } from '../types';

describe('Teams Integration - PlayerTeams Format', () => {
  describe('FFA Format Support', () => {
    it('should handle null teams field (defaults to FFA)', () => {
      const payload: Lobby = {
        game_id: 'ffa_null_1',
        teams: null,
        max_players: 8,
        game_map: 'Desert',
        approx_num_players: 6,
        first_seen_unix_sec: 1234567890,
        last_seen_unix_sec: 1234567900,
        completed: false,
        analysis_complete: false
      };
      
      const playerTeams = getPlayerTeams(payload);
      const formatted = formatPlayerTeams(playerTeams!);
      
      expect(playerTeams).toEqual({ group: 'FFA' });
      expect(formatted).toBe('FFA');
    });

    it('should handle structured FFA payload', () => {
      const payload: Lobby = {
        game_id: 'ffa_struct_1',
        teams: { group: 'FFA' },
        max_players: 16,
        game_map: 'Forest',
        approx_num_players: 12,
        first_seen_unix_sec: 1234567890,
        last_seen_unix_sec: 1234567900,
        completed: false,
        analysis_complete: false
      };
      
      const playerTeams = getPlayerTeams(payload);
      const formatted = formatPlayerTeams(playerTeams!);
      
      expect(playerTeams).toEqual({ group: 'FFA' });
      expect(formatted).toBe('FFA');
    });
  });

  describe('Teams Format Support', () => {
    it('should handle structured Teams payload', () => {
      const payload: Lobby = {
        game_id: 'teams_struct_1',
        teams: { group: 'Teams', num_teams: 4 },
        max_players: 8,
        game_map: 'Canyon',
        approx_num_players: 8,
        first_seen_unix_sec: 1234567890,
        last_seen_unix_sec: 1234567900,
        completed: true,
        analysis_complete: true
      };
      
      const playerTeams = getPlayerTeams(payload);
      const formatted = formatPlayerTeams(playerTeams!);
      
      expect(playerTeams).toEqual({ group: 'Teams', num_teams: 4 });
      expect(formatted).toBe('4 Teams');
    });

    it('should handle various team counts', () => {
      const payload: Lobby = {
        game_id: 'teams_various_1',
        teams: { group: 'Teams', num_teams: 6 },
        max_players: 12,
        game_map: 'Mountains',
        approx_num_players: 10,
        first_seen_unix_sec: 1234567890,
        last_seen_unix_sec: 1234567900,
        completed: false,
        analysis_complete: false
      };
      
      const playerTeams = getPlayerTeams(payload);
      const formatted = formatPlayerTeams(playerTeams!);
      
      expect(playerTeams).toEqual({ group: 'Teams', num_teams: 6 });
      expect(formatted).toBe('6 Teams');
    });

    it('should handle single team edge case', () => {
      const payload: Lobby = {
        game_id: 'teams_single_1',
        teams: { group: 'Teams', num_teams: 1 },
        max_players: 4,
        game_map: 'Arena',
        approx_num_players: 3,
        first_seen_unix_sec: 1234567890,
        last_seen_unix_sec: 1234567900,
        completed: false,
        analysis_complete: false
      };
      
      const playerTeams = getPlayerTeams(payload);
      const formatted = formatPlayerTeams(playerTeams!);
      
      expect(playerTeams).toEqual({ group: 'Teams', num_teams: 1 });
      expect(formatted).toBe('1 Teams');
    });
  });

  describe('Parties Format Support', () => {
    it('should handle structured Parties payload', () => {
      const payload: Lobby = {
        game_id: 'parties_struct_1',
        teams: { group: 'Parties', party_size: 3 },
        max_players: 12,
        game_map: 'Islands',
        approx_num_players: 9,
        first_seen_unix_sec: 1234567890,
        last_seen_unix_sec: 1234567900,
        completed: false,
        analysis_complete: false
      };
      
      const playerTeams = getPlayerTeams(payload);
      const formatted = formatPlayerTeams(playerTeams!);
      
      expect(playerTeams).toEqual({ group: 'Parties', party_size: 3 });
      expect(formatted).toBe('Parties (3)');
    });

    it('should handle large party sizes', () => {
      const payload: Lobby = {
        game_id: 'parties_large_1',
        teams: { group: 'Parties', party_size: 8 },
        max_players: 32,
        game_map: 'Continent',
        approx_num_players: 24,
        first_seen_unix_sec: 1234567890,
        last_seen_unix_sec: 1234567900,
        completed: false,
        analysis_complete: false
      };
      
      const playerTeams = getPlayerTeams(payload);
      const formatted = formatPlayerTeams(playerTeams!);
      
      expect(playerTeams).toEqual({ group: 'Parties', party_size: 8 });
      expect(formatted).toBe('Parties (8)');
    });

    it('should handle small party sizes', () => {
      const payload: Lobby = {
        game_id: 'parties_small_1',
        teams: { group: 'Parties', party_size: 2 },
        max_players: 8,
        game_map: 'Valley',
        approx_num_players: 6,
        first_seen_unix_sec: 1234567890,
        last_seen_unix_sec: 1234567900,
        completed: false,
        analysis_complete: false
      };
      
      const playerTeams = getPlayerTeams(payload);
      const formatted = formatPlayerTeams(playerTeams!);
      
      expect(playerTeams).toEqual({ group: 'Parties', party_size: 2 });
      expect(formatted).toBe('Parties (2)');
    });
  });

  describe('Error Resilience', () => {
    it('should handle undefined teams gracefully', () => {
      const payload: Lobby = {
        game_id: 'undefined_test',
        teams: undefined,
        max_players: 8,
        game_map: 'UndefinedMap',
        approx_num_players: 4,
        first_seen_unix_sec: 1234567890,
        last_seen_unix_sec: 1234567900,
        completed: false,
        analysis_complete: false
      };
      
      const playerTeams = getPlayerTeams(payload);
      const formatted = formatPlayerTeams(playerTeams!);
      
      expect(playerTeams).toEqual({ group: 'FFA' });
      expect(formatted).toBe('FFA');
    });
  });

  describe('End-to-End Workflow Tests', () => {
    it('should handle complete lobby workflow - FFA game', () => {
      const lobby: Lobby = {
        game_id: 'e2e_ffa_1',
        teams: { group: 'FFA' },
        max_players: 10,
        game_map: 'Battleground',
        approx_num_players: 7,
        first_seen_unix_sec: Date.now() - 300,
        last_seen_unix_sec: Date.now() - 60,
        completed: false,
        analysis_complete: false
      };

      const teams = getPlayerTeams(lobby);
      const display = formatPlayerTeams(teams!);

      expect(teams?.group).toBe('FFA');
      expect(display).toBe('FFA');
    });

    it('should handle complete lobby workflow - Teams game', () => {
      const lobby: Lobby = {
        game_id: 'e2e_teams_1',
        teams: { group: 'Teams', num_teams: 4 },
        max_players: 16,
        game_map: 'WarZone',
        approx_num_players: 14,
        first_seen_unix_sec: Date.now() - 600,
        last_seen_unix_sec: Date.now() - 30,
        completed: true,
        analysis_complete: true
      };

      const teams = getPlayerTeams(lobby);
      const display = formatPlayerTeams(teams!);

      expect(teams?.group).toBe('Teams');
      if (teams?.group === 'Teams') {
        expect(teams.num_teams).toBe(4);
      }
      expect(display).toBe('4 Teams');
    });

    it('should handle complete lobby workflow - Parties game', () => {
      const lobby: Lobby = {
        game_id: 'e2e_parties_1',
        teams: { group: 'Parties', party_size: 3 },
        max_players: 18,
        game_map: 'CoopMap',
        approx_num_players: 15,
        first_seen_unix_sec: Date.now() - 900,
        last_seen_unix_sec: Date.now() - 10,
        completed: false,
        analysis_complete: false
      };

      const teams = getPlayerTeams(lobby);
      const display = formatPlayerTeams(teams!);

      expect(teams?.group).toBe('Parties');
      if (teams?.group === 'Parties') {
        expect(teams.party_size).toBe(3);
      }
      expect(display).toBe('Parties (3)');
    });
  });
});
