/**
 * Submission Integration Tests — requires local Supabase running.
 * Automatically skipped in CI environments.
 *
 * To run locally:
 *   1. npx supabase start
 *   2. CI="" npx vitest run lib/services/__tests__/submission.integration.test.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => {
    const { getIntegrationClient } = await import("@/lib/test-utils/integration-runner");
    return getIntegrationClient();
  },
}));

const isCI = !!process.env.CI;

describe.skipIf(isCI)("Submission Integration Tests", () => {
  let getIntegrationClient: any;
  let createTestUser: any;
  let SubmissionService: any;
  let eventId: string;
  let submitterId: string;

  beforeAll(async () => {
    const runner = await import("@/lib/test-utils/integration-runner");
    getIntegrationClient = runner.getIntegrationClient;
    createTestUser = runner.createTestUser;

    const mod = await import("../submission.service");
    SubmissionService = mod.SubmissionService;

    const user = await createTestUser();
    submitterId = user.id;

    const supabase = getIntegrationClient();

    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .insert({ name: "Test Workspace", slug: `test-ws-sub-${Date.now()}` })
      .select("id")
      .single();
    if (wsError) throw wsError;

    const { data: ev, error: evError } = await supabase
      .from("events")
      .insert({
        workspace_id: ws.id,
        organizer_id: submitterId,
        title: "Test Event",
        description: "Integration test event",
        category: "Hackathon",
        format: "Online",
        state: "Active",
        team_size_min: 1,
        team_size_max: 4,
        network_mode: "testnet",
      })
      .select("id")
      .single();
    if (evError) throw evError;
    eventId = ev.id;

    await supabase.from("event_members").insert({
      event_id: eventId,
      user_id: submitterId,
      role: "Participant",
      availability: "Available",
    });
  }, 30000);

  it("should successfully submit a project and increment version on resubmission", async () => {
    const result = await SubmissionService.submitProject(eventId, submitterId, {
      title: "First Try",
      description: "My initial submission",
    });

    expect(result.submissionId).toBeDefined();
    expect(result.version).toBe(1);

    const supabase = getIntegrationClient();

    const { data: sub1 } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", result.submissionId)
      .single();
    expect(sub1?.status).toBe("Submitted");
    expect(sub1?.current_version).toBe(1);

    const result2 = await SubmissionService.submitProject(eventId, submitterId, {
      title: "Second Try",
      description: "My updated submission",
      projectUrl: "https://example.com",
    });

    expect(result2.submissionId).toBe(result.submissionId);
    expect(result2.version).toBe(2);
  });
});
