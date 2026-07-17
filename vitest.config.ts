import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/**',          // frontend — not tested here
        '**/*.config.*',
        'server/db/migrations/**',
        'server/db/migrator.ts',
      ],
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, 'server'),
    },
  },
});
