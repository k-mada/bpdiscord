import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    exclude: ['__tests__/fixtures/**'],
    testTimeout: 30000, // 30s for database operations
    hookTimeout: 30000, // 30s for setup/teardown
    env: {
      NODE_ENV: 'test',
    },
    // Every DB-backed file truncates shared tables in beforeEach, so two files
    // running at once delete each other's rows mid-test. sequence.concurrent
    // only orders tests *within* a file — fileParallelism is what stops vitest
    // running the files themselves in parallel workers.
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
