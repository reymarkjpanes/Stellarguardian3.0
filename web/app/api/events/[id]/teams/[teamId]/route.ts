/**
 * GET  /api/events/[id]/teams/[teamId]
 *
 *   Returns team detail with members. If the requester is the captain,
 *   also includes pending join requests (inbox) so they can accept/reject
 *   without a separate endpoint trip.
 *
 * DELETE /api/events/[id]/teams/[teamId]
 *
 *   Leave the team. Rules:
 *   - Captain leaving with members → auto-transfer to earliest-joined member.
 *   - Captain leaving alone (last member) → team row deleted.
 *   - Leaving also cleans up the user's pending invitations and join requests.
 */
import { apiHandler } from "@/lib/api-handler";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { okResponse } from "@/lib/errors/responses";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export const GET = apiHandler({ requireAuth: true }, async ({ params, user }) => {
  const { id: eventId, teamId } = params as { id: string; teamId: string };
  const supabase = await createServerClient();

  // ── Team basic info ────────────────────────────────────────────────────
  const { data: team } = await supabase
    .from("teams")
    .select("id, name, captain_id, version")
    .eq("id", teamId)
    .eq("event_id", eventId)
    .single();

  if (!team) throw new NotFoundError("Team not found.");

  // ── Members with display names ─────────────────────────────────────────
  const { data: memberships } = await supabase
    .from("team_members")
    .select("user_id, joined_at")
    .eq("team_id", teamId)
    .order("joined_at");

  const memberUserIds = (memberships ?? []).map((m) => m.user_id);
  const { data: usersData } =
    memberUserIds.length > 0
      ? await supabase.from("users").select("id, display_name").in("id", memberUserIds)
      : { data: [] };

  const usersMap = new Map((usersData ?? []).map((u) => [u.id, u.display_name]));

  const members = (memberships ?? []).map((m) => ({
    user_id: m.user_id,
    display_name: usersMap.get(m.user_id) ?? "Unknown",
    is_captain: m.user_id === team.captain_id,
    joined_at: m.joined_at,
  }));

  // ── Captain: include pending join requests ─────────────────────────────
  const isCaptain = user!.id === team.captain_id;
  let pendingRequests: Array<{
    id: string;
    user_id: string;
    display_name: string;
    message: string;
    created_at: string;
  }> = [];

  if (isCaptain) {
    const { data: requests } = await supabase
      .from("team_join_requests")
      .select("id, user_id, message, created_at")
      .eq("team_id", teamId)
      .eq("status", "pending")
      .order("created_at");

    if (requests && requests.length > 0) {
      const reqUserIds = requests.map((r) => r.user_id);
      const { data: reqUsers } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", reqUserIds);

      const reqUsersMap = new Map((reqUsers ?? []).map((u) => [u.id, u.display_name]));

      pendingRequests = requests.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        display_name: reqUsersMap.get(r.user_id) ?? "Unknown",
        message: r.message ?? "",
        created_at: r.created_at,
      }));
    }
  }

  return okResponse({
    id: team.id,
    name: team.name,
    captain_id: team.captain_id,
    version: team.version,
    members,
    pending_requests: pendingRequests,
    is_captain: isCaptain,
    is_member: memberUserIds.includes(user!.id),
  });
});

export const DELETE = apiHandler({ requireAuth: true }, async ({ params, user }) => {
  const { id: eventId, teamId } = params as { id: string; teamId: string };
  const service = createServiceClient();

  // ── Verify membership or organizer ────────────────────────────────────────
  const { data: membership } = await service
    .from("team_members")
    .select("user_id, joined_at")
    .eq("team_id", teamId)
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: eventMembership } = await service
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user!.id)
    .maybeSingle();

  const isOrganizer = eventMembership?.role === "Organizer";

  if (!membership && !isOrganizer) {
    throw new ForbiddenError("You are not a member of this team or an organizer.");
  }

  // ── Load team ──────────────────────────────────────────────────────────
  const { data: team } = await service
    .from("teams")
    .select("captain_id, event_id")
    .eq("id", teamId)
    .single();

  if (!team || team.event_id !== eventId) {
    throw new NotFoundError("Team not found in this event.");
  }

  if (isOrganizer && !membership) {
    // Organizer force deleting the team
    await service.from("teams").delete().eq("id", teamId);
    return okResponse({ left: true, team_disbanded: true, team_id: teamId });
  }

  const isCaptain = team.captain_id === user!.id;

  if (isCaptain) {
    // Count remaining members excluding self
    const { count } = await service
      .from("team_members")
      .select("user_id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .neq("user_id", user!.id);

    if ((count ?? 0) === 0) {
      // Last member leaving — delete the team entirely
      await service.from("teams").delete().eq("id", teamId);
      return okResponse({ left: true, team_disbanded: true, team_id: teamId });
    }

    // Transfer captaincy to the earliest-joined other member
    const { data: nextCaptain } = await service
      .from("team_members")
      .select("user_id, joined_at")
      .eq("team_id", teamId)
      .neq("user_id", user!.id)
      .order("joined_at")
      .limit(1)
      .single();

    if (nextCaptain) {
      await service.from("teams").update({ captain_id: nextCaptain.user_id }).eq("id", teamId);
    }
  }

  // ── Remove from team ───────────────────────────────────────────────────
  await service.from("team_members").delete().eq("team_id", teamId).eq("user_id", user!.id);

  // ── Clean up: cancel pending invites + requests from this user in event ─
  await service
    .from("team_invitations")
    .update({ status: "cancelled" })
    .eq("invitee_user_id", user!.id)
    .eq("event_id", eventId)
    .in("status", ["pending", "Pending"]);

  // Cancel join requests they sent to other teams
  const { data: allTeams } = await service.from("teams").select("id").eq("event_id", eventId);

  const otherTeamIds = (allTeams ?? []).map((t) => t.id).filter((id) => id !== teamId);

  if (otherTeamIds.length > 0) {
    await service
      .from("team_join_requests")
      .update({ status: "rejected" })
      .eq("user_id", user!.id)
      .eq("status", "pending")
      .in("team_id", otherTeamIds);
  }

  return okResponse({ left: true, team_disbanded: false, team_id: teamId });
});
