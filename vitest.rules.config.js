import { defineConfig } from 'vitest/config';

/**
 * Config Vitest dédiée aux tests de règles Firestore.
 * Nécessite l'émulateur Firestore (via `npm run test:rules`).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.{test,spec}.{js,ts}'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
