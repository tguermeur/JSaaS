import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires routing Stripe (sans émulateur Firebase).
 * Lancer via : npm run test:stripe
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/stripe/**/*.{test,spec}.{js,ts}'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
