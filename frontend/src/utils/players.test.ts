import { describe, it, expect } from 'vitest';
import { humansOnly, getPlayerTypeLabel } from './players';

describe('players utility functions', () => {
  describe('humansOnly', () => {
    it('should filter to only human and fakehuman players (case-insensitive)', () => {
      const players = [
        { id: '1', player_type: 'HUMAN', name: 'Alice' },
        { id: '2', player_type: 'BOT', name: 'Bot1' },
        { id: '3', player_type: 'FAKEHUMAN', name: 'Nation1' },
        { id: '4', player_type: 'human', name: 'Bob' },
        { id: '5', player_type: 'bot', name: 'Bot2' },
        { id: '6', player_type: 'fakehuman', name: 'Nation2' },
        { id: '7', player_type: 'unknown', name: 'Unknown' },
        { id: '8', player_type: undefined, name: 'NoType' },
      ];

      const result = humansOnly(players);

      expect(result).toHaveLength(4);
      expect(result.map(p => p.name)).toEqual(['Alice', 'Nation1', 'Bob', 'Nation2']);
    });

    it('should return empty array when no human players', () => {
      const players = [
        { id: '1', player_type: 'BOT', name: 'Bot1' },
        { id: '2', player_type: 'bot', name: 'Bot2' },
      ];

      const result = humansOnly(players);
      expect(result).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const result = humansOnly([]);
      expect(result).toHaveLength(0);
    });

    it('should handle undefined/null input gracefully', () => {
      const result = humansOnly(undefined);
      expect(result).toHaveLength(0);
    });
  });

  describe('getPlayerTypeLabel', () => {
    it('should return correct labels for player types', () => {
      expect(getPlayerTypeLabel('human')).toBe('player');
      expect(getPlayerTypeLabel('HUMAN')).toBe('player');
      expect(getPlayerTypeLabel('fakehuman')).toBe('nation');
      expect(getPlayerTypeLabel('FAKEHUMAN')).toBe('nation');
      expect(getPlayerTypeLabel('bot')).toBe('bot');
      expect(getPlayerTypeLabel('BOT')).toBe('bot');
      expect(getPlayerTypeLabel('unknown')).toBe('unknown');
      expect(getPlayerTypeLabel(undefined)).toBe('');
    });
  });
});
