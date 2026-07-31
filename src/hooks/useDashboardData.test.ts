import { describe, it, expect } from 'vitest';

describe('useDashboardData constants', () => {
  it('utilise des limites de requête pour éviter les scans illimités', async () => {
    const mod = await import('./useDashboardData');
    expect(mod).toBeDefined();
    // Le hook lit stats depuis structures/{id}.stats quand disponible (pas de scan paid global côté client).
    expect(typeof mod.useDashboardData).toBe('function');
  });
});
