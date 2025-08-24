import { describe, it, expect } from 'vitest';
import { filterStatsByDuration, PlayerStatsOverGame, PlayerStatsOnTick, DurationFilter, calculateConstructionCost } from './charts';

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

describe('calculateConstructionCost', () => {
  const mockStatsData: PlayerStatsOverGame = {
    player_stats_ticks: {
      100: [
        { client_id: 'player1', name: 'Player One', gold: 1000, troops: 0, workers: 0, tiles_owned: 0 },
        { client_id: 'player2', name: 'Player Two', gold: 500, troops: 0, workers: 0, tiles_owned: 0 }
      ],
      200: [
        { client_id: 'player1', name: 'Player One', gold: 850, troops: 0, workers: 0, tiles_owned: 0 },
        { client_id: 'player2', name: 'Player Two', gold: 300, troops: 0, workers: 0, tiles_owned: 0 }
      ],
      300: [
        { client_id: 'player1', name: 'Player One', gold: 700, troops: 0, workers: 0, tiles_owned: 0 },
        { client_id: 'player2', name: 'Player Two', gold: 100, troops: 0, workers: 0, tiles_owned: 0 }
      ]
    }
  };

  it('calculates cost correctly when gold decreases between ticks', () => {
    // Player 1: 1000 -> 850, so cost = 150
    const cost = calculateConstructionCost(200, 'player1', mockStatsData);
    expect(cost).toBe(150);
  });

  it('calculates cost correctly for different player', () => {
    // Player 2: 500 -> 300, so cost = 200
    const cost = calculateConstructionCost(200, 'player2', mockStatsData);
    expect(cost).toBe(200);
  });

  it('returns null when player is not found in before tick', () => {
    const cost = calculateConstructionCost(200, 'unknown_player', mockStatsData);
    expect(cost).toBeNull();
  });

  it('returns null when player is not found in after tick', () => {
    // Add a scenario where player exists in before tick but not after
    const limitedStatsData: PlayerStatsOverGame = {
      player_stats_ticks: {
        100: [{ client_id: 'player1', name: 'Player One', gold: 1000, troops: 0, workers: 0, tiles_owned: 0 }],
        200: [{ client_id: 'player2', name: 'Player Two', gold: 300, troops: 0, workers: 0, tiles_owned: 0 }] // player1 missing
      }
    };
    
    const cost = calculateConstructionCost(200, 'player1', limitedStatsData);
    expect(cost).toBeNull();
  });

  it('returns null when before tick does not exist', () => {
    const cost = calculateConstructionCost(50, 'player1', mockStatsData); // Tick 50 doesn't exist
    expect(cost).toBeNull();
  });

  it('returns null when after tick does not exist', () => {
    const cost = calculateConstructionCost(400, 'player1', mockStatsData); // Tick 400 doesn't exist
    expect(cost).toBeNull();
  });

  it('handles case when gold increases (returns 0)', () => {
    // Create scenario where gold increases instead of decreases
    const increasingGoldData: PlayerStatsOverGame = {
      player_stats_ticks: {
        100: [{ client_id: 'player1', name: 'Player One', gold: 500, troops: 0, workers: 0, tiles_owned: 0 }],
        200: [{ client_id: 'player1', name: 'Player One', gold: 800, troops: 0, workers: 0, tiles_owned: 0 }] // Gold increased
      }
    };
    
    const cost = calculateConstructionCost(200, 'player1', increasingGoldData);
    expect(cost).toBe(0); // Cost can't be negative
  });

  it('handles case when gold stays the same (returns 0)', () => {
    // Create scenario where gold stays the same
    const sameGoldData: PlayerStatsOverGame = {
      player_stats_ticks: {
        100: [{ client_id: 'player1', name: 'Player One', gold: 500, troops: 0, workers: 0, tiles_owned: 0 }],
        200: [{ client_id: 'player1', name: 'Player One', gold: 500, troops: 0, workers: 0, tiles_owned: 0 }] // Same gold
      }
    };
    
    const cost = calculateConstructionCost(200, 'player1', sameGoldData);
    expect(cost).toBe(0);
  });

  it('calculates multiple construction costs for same player correctly', () => {
    // Test consecutive construction events
    const cost1 = calculateConstructionCost(200, 'player1', mockStatsData); // 1000 -> 850 = 150
    const cost2 = calculateConstructionCost(300, 'player1', mockStatsData); // 850 -> 700 = 150
    
    expect(cost1).toBe(150);
    expect(cost2).toBe(150);
  });

  it('works with edge case of tick 0 and later tick', () => {
    const edgeCaseData: PlayerStatsOverGame = {
      player_stats_ticks: {
        0: [{ client_id: 'player1', name: 'Player One', gold: 1000, troops: 0, workers: 0, tiles_owned: 0 }],
        100: [{ client_id: 'player1', name: 'Player One', gold: 750, troops: 0, workers: 0, tiles_owned: 0 }]
      }
    };
    
    const cost = calculateConstructionCost(100, 'player1', edgeCaseData);
    expect(cost).toBe(250);
  });

  it('handles large tick numbers correctly', () => {
    const largeTickData: PlayerStatsOverGame = {
      player_stats_ticks: {
        9900: [{ client_id: 'player1', name: 'Player One', gold: 2000, troops: 0, workers: 0, tiles_owned: 0 }],
        10000: [{ client_id: 'player1', name: 'Player One', gold: 1500, troops: 0, workers: 0, tiles_owned: 0 }]
      }
    };
    
    const cost = calculateConstructionCost(10000, 'player1', largeTickData);
    expect(cost).toBe(500);
  });

  it('finds correct before tick by looking at previous available tick', () => {
    // Test that it correctly finds the previous tick (not always currentTick - 100)
    const irregularTickData: PlayerStatsOverGame = {
      player_stats_ticks: {
        250: [{ client_id: 'player1', name: 'Player One', gold: 1200, troops: 0, workers: 0, tiles_owned: 0 }],
        800: [{ client_id: 'player1', name: 'Player One', gold: 900, troops: 0, workers: 0, tiles_owned: 0 }]
      }
    };
    
    const cost = calculateConstructionCost(800, 'player1', irregularTickData);
    expect(cost).toBe(300); // 1200 -> 900 = 300
  });

  it('handles multiple players in same tick correctly', () => {
    // Verify it picks the right player from the array
    const cost1 = calculateConstructionCost(200, 'player1', mockStatsData);
    const cost2 = calculateConstructionCost(200, 'player2', mockStatsData);
    
    expect(cost1).toBe(150); // player1: 1000 -> 850
    expect(cost2).toBe(200); // player2: 500 -> 300
  });

  it('returns null when statsData is null', () => {
    const cost = calculateConstructionCost(200, 'player1', null);
    expect(cost).toBeNull();
  });
});
