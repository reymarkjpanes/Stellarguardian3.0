import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest configuration for the Next.js App Router app.
// Uses the project's `@/*` path alias (see tsconfig.json) via Vite's native
// tsconfig paths resolution, plus the React plugin for any component tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "supabase/migrations"],
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
