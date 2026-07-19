import { defineConfig, mergeConfig } from 'vitest/config';
import vitestConfig from './vitest.config';

export default mergeConfig(
  vitestConfig,
  defineConfig({
    test: {
      include: ['**/*.integration.test.ts'],
      // We don't want server-only mocked in integration tests
      // because we actually want to hit the Supabase local DB
      // over HTTP using the server-side Supabase client!
      alias: {
        '@': __dirname,
      },
      // Since it runs against a real database, disable concurrency
      // unless tests are carefully isolated by data.
      fileParallelism: false, 
      testTimeout: 30000, // 30s timeout for DB ops
    },
  })
);
