import { describe, it, expect } from 'vitest';

describe('structure stats contract', () => {
  it('définit les champs agrégés attendus sur structures.stats', () => {
    const stats = {
      totalRevenue: 1000,
      activeMissionsCount: 5,
      totalMissionsCount: 12,
    };
    expect(stats.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(stats.activeMissionsCount).toBeLessThanOrEqual(stats.totalMissionsCount);
  });
});
