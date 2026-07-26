/**
 * Team Formation and Management Service (Req 10.1-10.7).
 *
 * Create teams (creator = captain + first member), enforce teamSizeMax and
 * one-team-per-participant, invitation/accept/leave flows with captain
 * transfer to earliest-joined member.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { writeAuditRecord } from "./audit";
import { createNotification } from "./notification";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";

/**
 * Create a team (Req 10.1). Creator becomes captain and first member.
 */
export async function createTeam(params: {
  eventId: string;
  creatorId: string;
  name: string;
}): Promise<{ id: string; name: string }> {
  const supabase = createServiceClient();

  // Verify event allows team formation
  const { data: event } = await supabase
    .from("events")
    .select("id, state, team_size_max")
    .eq("id", params.eventId)
    .single();

  if (!event) throw new NotFoundError("Event not found.");
  if (!["TeamFormationLocked", "RegistrationOpen", "RegistrationClosed"].includes(event.state)) {
    throw new BadRequestError("Teams can only be created during team formation.");
  }

  // Enforce one-team-per-participant (Req 10.7)
  const { data: existingMembership } = await supabase
    .from("team_members")
    .select("team_id, teams!inner(event_id)")
    .eq("user_id", params.creatorId)
    .eq("teams.event_id", params.eventId)
    .maybeSingle();

  if (existingMembership) {
    throw new ConflictError("You are already a member of a team in this event (Req 10.7).");
  }

  // Create the team
  const { data: team, error } = await supabase
    .from("teams")
    .insert({
      event_id: params.eventId,
      name: params.name,
      captain_id: params.creatorId,
      version: 0,
    })
    .select("id, name")
    .single();

  if (error) throw new Error(`Failed to create team: ${error.message}`);

  // Add creator as first member
  await supabase.from("team_members").insert({
    team_id: team.id,
    user_id: params.creatorId,
    joined_at: new Date().toISOString(),
  });

  await writeAuditRecord({
    action: "team.create",
    actor_id: params.creatorId,
    event_id: params.eventId,
    resource_type: "teams",
    resource_id: team.id,
    metadata: { name: params.name },
  });

  return team;
}

/**
 * Join a team (Req 10.2). Enforces teamSizeMax and one-team-per-participant.
 */
export async function joinTeam(params: { teamId: string; userId: string }): Promise<void> {
  const supabase = createServiceClient();

  // Get team and event info
  const { data: team } = await supabase
    .from("teams")
    .select("id, event_id, captain_id")
    .eq("id", params.teamId)
    .single();

  if (!team) throw new NotFoundError("Team not found.");

  const { data: event } = await supabase
    .from("events")
    .select("team_size_max")
    .eq("id", team.event_id)
    .single();

  if (!event) throw new NotFoundError("Event not found.");

  // Enforce one-team-per-participant (Req 10.7)
  const { data: existingMembership } = await supabase
    .from("team_members")
    .select("team_id, teams!inner(event_id)")
    .eq("user_id", params.userId)
    .eq("teams.event_id", team.event_id)
    .maybeSingle();

  if (existingMembership) {
    throw new ConflictError("You are already a member of a team in this event (Req 10.7).");
  }

  // Enforce teamSizeMax (Req 10.2)
  const { count } = await supabase
    .from("team_members")
    .select("user_id", { count: "exact", head: true })
    .eq("team_id", params.teamId);

  if (count !== null && count >= event.team_size_max) {
    throw new BadRequestError(
      `Team has reached its maximum size of ${event.team_size_max} members.`,
    );
  }

  // Add member
  const { error } = await supabase.from("team_members").insert({
    team_id: params.teamId,
    user_id: params.userId,
    joined_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      throw new ConflictError("You are already a member of this team.");
    }
    throw new Error(`Failed to join team: ${error.message}`);
  }

  // Notify captain
  await createNotification({
    userId: team.captain_id,
    category: "team",
    title: "New team member",
    body: "A new member has joined your team.",
    eventId: team.event_id,
  });

  await writeAuditRecord({
    action: "team.member_join",
    actor_id: params.userId,
    event_id: team.event_id,
    resource_type: "teams",
    resource_id: params.teamId,
  });
}

/**
 * Leave a team (Req 10.4). If captain leaves, transfer to earliest-joined (Req 10.5).
 */
export async function leaveTeam(params: { teamId: string; userId: string }): Promise<void> {
  const supabase = createServiceClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, event_id, captain_id")
    .eq("id", params.teamId)
    .single();

  if (!team) throw new NotFoundError("Team not found.");

  // Remove member
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", params.teamId)
    .eq("user_id", params.userId);

  if (error) throw new Error(`Failed to leave team: ${error.message}`);

  // If captain left, transfer to earliest-joined (Req 10.5)
  if (team.captain_id === params.userId) {
    const { data: remaining } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", params.teamId)
      .order("joined_at", { ascending: true })
      .limit(1);

    const newCaptain = remaining?.[0];
    if (newCaptain) {
      await supabase
        .from("teams")
        .update({ captain_id: newCaptain.user_id })
        .eq("id", params.teamId);
    } else {
      // Team is now empty — optionally delete it
      await supabase.from("teams").delete().eq("id", params.teamId);
    }
  }

  await writeAuditRecord({
    action: "team.member_leave",
    actor_id: params.userId,
    event_id: team.event_id,
    resource_type: "teams",
    resource_id: params.teamId,
  });
}
