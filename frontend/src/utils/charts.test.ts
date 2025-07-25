import { describe, it, expect } from 'vitest';
import { filterStatsByDuration, PlayerStatsOverGame, PlayerStatsOnTick, DurationFilter } from './charts';

describe('filterStatsByDuration', () => {
  // Sample test data
  const samplePlayerStats: PlayerStatsOnTick[] = [
    {
      client_id: 'player1',
      name: 'Player 1',
      tiles_owned: 10,
      gold: 100,
      workers: 5,
      troops: 15
    },
    {
      client_id: 'player2',
      name: 'Player 2',
      tiles_owned: 8,
      gold: 80,
      workers: 4,
      troops: 12
    }
  ];

  const createTestData = (ticks: number[]): PlayerStatsOverGame => {
    const player_stats_ticks: Record<number, PlayerStatsOnTick[]> = {};
    ticks.forEach(tick => {
      player_stats_ticks[tick] = [...samplePlayerStats];
    });
    
    return {
      player_stats_ticks
    };
  };

  it('should return original object when duration is "all"', () => {
    const testData = createTestData([10, 100, 500, 1000, 2000]);
    const result = filterStatsByDuration(testData, 'all');
    
    expect(result).toBe(testData); // Should be the exact same object reference
    expect(result.player_stats_ticks).toEqual(testData.player_stats_ticks);
  });

  it('should filter ticks within 1 minute duration', () => {
    // minTick = 100, 1 minute = 60 * 10 = 600 ticks
    // threshold = 100 + 600 = 700
    const testData = createTestData([100, 200, 300, 700, 800, 1000]);
    const result = filterStatsByDuration(testData, 1);
    
    // Should keep ticks <= 700
    expect(Object.keys(result.player_stats_ticks).map(Number).sort((a, b) => a - b)).toEqual([100, 200, 300, 700]);
    expect(result.player_stats_ticks[100]).toEqual(samplePlayerStats);
    expect(result.player_stats_ticks[200]).toEqual(samplePlayerStats);
    expect(result.player_stats_ticks[300]).toEqual(samplePlayerStats);
    expect(result.player_stats_ticks[700]).toEqual(samplePlayerStats);
    expect(result.player_stats_ticks[800]).toBeUndefined();
    expect(result.player_stats_ticks[1000]).toBeUndefined();
  });

  it('should filter ticks within 3 minute duration', () => {
    // minTick = 50, 3 minutes = 3 * 60 * 10 = 1800 ticks
    // threshold = 50 + 1800 = 1850
    const testData = createTestData([50, 500, 1000, 1850, 1900, 2500]);
    const result = filterStatsByDuration(testData, 3);
    
    // Should keep ticks <= 1850
    expect(Object.keys(result.player_stats_ticks).map(Number).sort((a, b) => a - b)).toEqual([50, 500, 1000, 1850]);
    expect(result.player_stats_ticks[1900]).toBeUndefined();
    expect(result.player_stats_ticks[2500]).toBeUndefined();
  });

  it('should filter ticks within 10 minute duration', () => {
    // minTick = 0, 10 minutes = 10 * 60 * 10 = 6000 ticks
    // threshold = 0 + 6000 = 6000
    const testData = createTestData([0, 1000, 3000, 6000, 6001, 10000]);
    const result = filterStatsByDuration(testData, 10);
    
    // Should keep ticks <= 6000
    expect(Object.keys(result.player_stats_ticks).map(Number).sort((a, b) => a - b)).toEqual([0, 1000, 3000, 6000]);
    expect(result.player_stats_ticks[6001]).toBeUndefined();
    expect(result.player_stats_ticks[10000]).toBeUndefined();
  });

  it('should filter ticks within 30 minute duration', () => {
    // minTick = 200, 30 minutes = 30 * 60 * 10 = 18000 ticks
    // threshold = 200 + 18000 = 18200
    const testData = createTestData([200, 5000, 10000, 18200, 18201, 25000]);
    const result = filterStatsByDuration(testData, 30);
    
    // Should keep ticks <= 18200
    expect(Object.keys(result.player_stats_ticks).map(Number).sort((a, b) => a - b)).toEqual([200, 5000, 10000, 18200]);
    expect(result.player_stats_ticks[18201]).toBeUndefined();
    expect(result.player_stats_ticks[25000]).toBeUndefined();
  });

  it('should preserve original data structure and content', () => {
    const originalData = createTestData([100, 200, 300, 1000]);
    const result = filterStatsByDuration(originalData, 1); // Should keep 100, 200, 300 (threshold = 100 + 600 = 700)
    
    // Check that original structure is preserved
    expect(result).toHaveProperty('player_stats_ticks');
    expect(typeof result.player_stats_ticks).toBe('object');
    
    // Check that player data is intact within filtered ticks
    expect(result.player_stats_ticks[100]).toEqual(samplePlayerStats);
    expect(result.player_stats_ticks[200]).toEqual(samplePlayerStats);
    expect(result.player_stats_ticks[300]).toEqual(samplePlayerStats);
    
    // Verify the player stats content is preserved exactly
    expect(result.player_stats_ticks[100][0]).toEqual({
      client_id: 'player1',
      name: 'Player 1',
      tiles_owned: 10,
      gold: 100,
      workers: 5,
      troops: 15
    });
  });

  it('should handle empty player_stats_ticks', () => {
    const emptyData: PlayerStatsOverGame = {
      player_stats_ticks: {}
    };
    
    const result = filterStatsByDuration(emptyData, 1);
    expect(result).toEqual(emptyData);
    expect(Object.keys(result.player_stats_ticks)).toHaveLength(0);
  });

  it('should handle single tick within range', () => {
    const testData = createTestData([500]);
    const result = filterStatsByDuration(testData, 1); // threshold = 500 + 600 = 1100
    
    expect(Object.keys(result.player_stats_ticks).map(Number)).toEqual([500]);
    expect(result.player_stats_ticks[500]).toEqual(samplePlayerStats);
  });

  it('should handle single tick outside range', () => {
    const testData = createTestData([1500]);
    const result = filterStatsByDuration(testData, 1); // threshold = 1500 + 600 = 2100, but only tick is 1500 so it's included
    
    expect(Object.keys(result.player_stats_ticks).map(Number)).toEqual([1500]);
    expect(result.player_stats_ticks[1500]).toEqual(samplePlayerStats);
  });

  it('should handle edge case where all ticks are beyond threshold', () => {
    // minTick = 2000, 1 minute threshold = 2000 + 600 = 2600
    const testData = createTestData([2000, 3000, 4000]);
    const result = filterStatsByDuration(testData, 1);
    
    // Only tick 2000 should remain (it's <= 2600)
    expect(Object.keys(result.player_stats_ticks).map(Number)).toEqual([2000]);
    expect(result.player_stats_ticks[2000]).toEqual(samplePlayerStats);
    expect(result.player_stats_ticks[3000]).toBeUndefined();
    expect(result.player_stats_ticks[4000]).toBeUndefined();
  });

  it('should create a new object and not mutate original', () => {
    const originalData = createTestData([100, 200, 1000, 2000]);
    const originalKeys = Object.keys(originalData.player_stats_ticks);
    
    const result = filterStatsByDuration(originalData, 1);
    
    // Original should be unchanged
    expect(Object.keys(originalData.player_stats_ticks)).toEqual(originalKeys);
    expect(originalData.player_stats_ticks[1000]).toBeDefined();
    expect(originalData.player_stats_ticks[2000]).toBeDefined();
    
    // Result should be different object with filtered data
    expect(result).not.toBe(originalData);
    expect(result.player_stats_ticks).not.toBe(originalData.player_stats_ticks);
  });

  it('should correctly calculate threshold with different minTicks', () => {
    // Test with minTick = 1000
    const testData1 = createTestData([1000, 1300, 1600, 1700]);
    const result1 = filterStatsByDuration(testData1, 1); // threshold = 1000 + 600 = 1600
    expect(Object.keys(result1.player_stats_ticks).map(Number).sort((a, b) => a - b)).toEqual([1000, 1300, 1600]);
    
    // Test with minTick = 5000  
    const testData2 = createTestData([5000, 5200, 5500, 5700]);
    const result2 = filterStatsByDuration(testData2, 1); // threshold = 5000 + 600 = 5600
    expect(Object.keys(result2.player_stats_ticks).map(Number).sort((a, b) => a - b)).toEqual([5000, 5200, 5500]);
  });
});
