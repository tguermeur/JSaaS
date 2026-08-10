import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires quota signatures (Admin SDK + émulateur Firestore).
 * Lancer via : npm run test:quota
 */
export default defineConfig({
  resolve: {
    dedupe: ['firebase-admin', 'firebase-functions', '@google-cloud/firestore'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/quota/**/*.{test,spec}.{js,ts}'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
