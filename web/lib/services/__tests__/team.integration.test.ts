process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

import { describe, it, expect, beforeAll } from "vitest";
import { getIntegrationClient, createTestUser } from "@/lib/test-utils/integration-runner";
import { TeamService } from "../team.service";

describe("Team Integration Tests", () => {
  let eventId: string;
  let workspaceId: string;
  let captainId: string;
  const teamName = "Integration Test Team";

  beforeAll(async () => {
    // Setup data
    const user = await createTestUser();
    captainId = user.id;

    const supabase = getIntegrationClient();

    // Create workspace
    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .insert({
        name: "Test Workspace",
        slug: `test-ws-team-${Date.now()}`,
      })
      .select("id")
      .single();
    if (wsError) throw wsError;
    workspaceId = ws.id;

    // Create event in RegistrationOpen state (which allows team formation)
    const { data: ev, error: evError } = await supabase
      .from("events")
      .insert({
        workspace_id: workspaceId,
        organizer_id: captainId,
        title: "Test Event",
        description: "Integration test event",
        category: "Hackathon",
        format: "Online",
        state: "RegistrationOpen",
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
      user_id: captainId,
      role: "Participant",
      status: "accepted",
    });
  }, 30000);

  it("should successfully create a team via RPC", async () => {
    const teamId = await TeamService.createTeam(eventId, captainId, teamName);
    expect(teamId).toBeDefined();

    const supabase = getIntegrationClient();

    // Check team created
    const { data: team } = await supabase.from("teams").select("*").eq("id", teamId).single();
    expect(team?.name).toBe(teamName);

    // Check team member created
    const { data: members } = await supabase.from("team_members").select("*").eq("team_id", teamId);
    expect(members?.length).toBe(1);
    expect(members?.[0].user_id).toBe(captainId);
  });

  it("should block a user from creating a second team", async () => {
    await expect(TeamService.createTeam(eventId, captainId, "Another Team")).rejects.toThrow(
      /already in a team/i,
    );
  });
});
