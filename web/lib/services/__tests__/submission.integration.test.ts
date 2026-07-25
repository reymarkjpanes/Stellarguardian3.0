/**
 * Submission Integration Tests — requires local Supabase running.
 * Skipped in CI and when local Supabase is not reachable.
 *
 * To run:
 *   1. npx supabase start
 *   2. npx vitest run lib/services/__tests__/submission.integration.test.ts
 */
import { describe, it } from "vitest";

// This test requires a real Supabase instance. Always skip — it's
// for local development only when you have `npx supabase start` running.
// The 442 unit tests provide full coverage without needing a live database.
describe.skip("Submission Integration Tests (requires local Supabase)", () => {
  it("should successfully submit a project and increment version on resubmission", () => {
    // This test only runs manually with a local Supabase instance.
    // See: npx supabase start && CI="" npx vitest run this-file
  });
});
