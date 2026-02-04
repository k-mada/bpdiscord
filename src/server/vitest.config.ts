import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    exclude: ['__tests__/fixtures/**'],
    testTimeout: 30000, // 30s for database operations
    hookTimeout: 30000, // 30s for setup/teardown
    // Set NODE_ENV for test database selection
    env: {
      NODE_ENV: 'test',
    },
    // Run tests sequentially to avoid database conflicts
    sequence: {
      concurrent: false,
    },
  },
});
