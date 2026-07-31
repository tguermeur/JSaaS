import { describe, it, expect } from 'vitest';
import {
  getPeriodRange,
  getPreviousPeriodRange,
  isDateInRange,
  computeDelta,
  buildSparklineSeries,
} from './useDashboardPeriod';

describe('useDashboardPeriod', () => {
  const ref = new Date('2026-06-17T12:00:00');

  it('calcule la plage du mois courant', () => {
    const range = getPeriodRange('mois', ref);
    expect(range.start.getDate()).toBe(1);
    expect(range.start.getMonth()).toBe(5);
    expect(range.end.getMonth()).toBe(5);
    expect(range.label).toBe('Ce mois');
  });

  it('filtre les dates dans la plage', () => {
    const range = getPeriodRange('mois', ref);
    expect(isDateInRange('2026-06-10', range)).toBe(true);
    expect(isDateInRange('2026-05-31', range)).toBe(false);
  });

  it('calcule le delta en pourcentage', () => {
    expect(computeDelta(120, 100)).toBe(20);
    expect(computeDelta(0, 0)).toBeNull();
    expect(computeDelta(10, 0)).toBe(100);
  });

  it('réduit une série en sparkline', () => {
    const series = buildSparklineSeries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(series).toHaveLength(5);
    expect(series[0]).toBe(1);
    expect(series[4]).toBe(9);
  });

  it('retourne une plage précédente contiguë', () => {
    const current = getPeriodRange('jour', ref);
    const prev = getPreviousPeriodRange('jour', ref);
    expect(prev.end.getTime()).toBeLessThan(current.start.getTime());
  });
});
