import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires Stripe (permissions checkout, helpers).
 * Lancer via : npm run test:stripe
 */
export default defineConfig({
  resolve: {
    dedupe: ['firebase-admin', 'firebase-functions', '@google-cloud/firestore'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/stripe/**/*.{test,spec}.{js,ts}'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
