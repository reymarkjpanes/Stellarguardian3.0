process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

import { describe, it, expect, beforeAll, vi } from "vitest";
import { getIntegrationClient, createTestUser } from "@/lib/test-utils/integration-runner";

vi.mock("@/lib/supabase/server", () => {
  return {
    createServerClient: async () => {
      // Return the integration client (service role) to bypass cookies in tests
      return getIntegrationClient();
    },
  };
});
import { SubmissionService } from "../submission.service";

describe("Submission Integration Tests", () => {
  let eventId: string;
  let workspaceId: string;
  let submitterId: string;

  beforeAll(async () => {
    // Setup data
    const user = await createTestUser();
    submitterId = user.id;

    const supabase = getIntegrationClient();

    // Create workspace
    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .insert({
        name: "Test Workspace",
        slug: `test-ws-sub-${Date.now()}`,
      })
      .select("id")
      .single();
    if (wsError) throw wsError;
    workspaceId = ws.id;

    // Create event in SubmissionOpen state
    const { data: ev, error: evError } = await supabase
      .from("events")
      .insert({
        workspace_id: workspaceId,
        organizer_id: submitterId,
        title: "Test Event",
        description: "Integration test event",
        category: "Hackathon",
        format: "Online",
        state: "SubmissionOpen",
        team_size_min: 1,
        team_size_max: 4,
        network_mode: "testnet",
      })
      .select("id")
      .single();
    if (evError) throw evError;
    eventId = ev.id;

    // Add user as accepted participant
    await supabase.from("event_members").insert({
      event_id: eventId,
      user_id: submitterId,
      role: "Participant",
      status: "accepted",
    });
  }, 30000);

  it("should successfully submit a project and increment version on resubmission", async () => {
    // First submission
    const result = await SubmissionService.submitProject(eventId, submitterId, {
      title: "First Try",
      description: "My initial submission",
    });

    expect(result.submissionId).toBeDefined();
    expect(result.version).toBe(1);

    const supabase = getIntegrationClient();

    // Verify first version
    const { data: sub1 } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", result.submissionId)
      .single();
    expect(sub1?.status).toBe("Submitted");
    expect(sub1?.current_version).toBe(1);

    // Resubmit
    const result2 = await SubmissionService.submitProject(eventId, submitterId, {
      title: "Second Try",
      description: "My updated submission",
      projectUrl: "https://example.com",
    });

    expect(result2.submissionId).toBe(result.submissionId);
    expect(result2.version).toBe(2);

    // Verify resubmission
    const { data: sub2 } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", result.submissionId)
      .single();
    expect(sub2?.status).toBe("Resubmitted");
    expect(sub2?.current_version).toBe(2);

    // Verify version content
    const { data: versions } = await supabase
      .from("submission_versions")
      .select("*")
      .eq("submission_id", result.submissionId)
      .order("version_no", { ascending: true });

    expect(versions?.length).toBe(2);
    expect(versions?.[0].content.title).toBe("First Try");
    expect(versions?.[1].content.title).toBe("Second Try");
  });
});
