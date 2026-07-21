import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest configuration for the Next.js App Router app.
// Uses the project's `@/*` path alias (see tsconfig.json) via Vite's native
// tsconfig paths resolution, plus the React plugin for any component tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Mock server-only in test environment so server modules can be imported
      "server-only": new URL("./lib/test-utils/server-only-mock.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "supabase/migrations", "tests/e2e/**", "e2e/**"],
    // Each test file runs in its own context — prevents vi.mock() leaking between files.
    pool: "forks",
    // Increase timeout: some escrow/Stellar tests are slow due to module loading overhead.
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "**/*.config.*",
        "supabase/migrations/**",
        "lib/test-utils/**",
      ],
    },
  },
});
