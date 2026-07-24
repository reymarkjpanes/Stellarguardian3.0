/**
 * POST /api/events/[id]/teams/[teamId]/invitations
 *
 *   Any team member (captain OR regular member) can invite a registered,
 *   team-less participant. Reason: in real hackathons teammates recruit from
 *   their networks — restricting invites to the captain alone creates a
 *   bottleneck. The invite creates a record; the invitee accepts/declines.
 *
 * GET /api/events/[id]/teams/[teamId]/invitations
 *
 *   Captain sees all sent invitations with status (pending/accepted/declined/cancelled).
 *   Regular members see only their own sent invitations.
 */
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { okResponse, createdResponse } from "@/lib/errors/responses";
import { ForbiddenError, NotFoundError, ConflictError, BadRequestError } from "@/lib/errors";

const SendInviteSchema = z.object({
  invitee_user_id: z.string().uuid("Must be a valid user ID"),
  message: z.string().max(300).optional().default(""),
});

export const POST = apiHandler(
  { requireAuth: true, schema: SendInviteSchema },
  async ({ params, user, body }) => {
    const { id: eventId, teamId } = params as { id: string; teamId: string };
    const supabase = await createServerClient();
    const service = createServiceClient();

    // ── 1. Verify team belongs to event ───────────────────────────────────
    const { data: team } = await supabase
      .from("teams")
      .select("id, name, captain_id")
      .eq("id", teamId)
      .eq("event_id", eventId)
      .single();

    if (!team) throw new NotFoundError("Team not found.");

    // ── 2. Sender must be an active member of this team ───────────────────
    const { data: senderMembership } = await supabase
      .from("team_members")
      .select("user_id, joined_at")
      .eq("team_id", teamId)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!senderMembership) {
      throw new ForbiddenError("You must be a member of this team to send invitations.");
    }

    const senderIsCaptain = team.captain_id === user!.id;

    // ── 3. Cannot invite yourself ──────────────────────────────────────────
    if (body.invitee_user_id === user!.id) {
      throw new BadRequestError("You cannot invite yourself.");
    }

    // ── 4. Target must be a registered Participant in this event ──────────
    const { data: targetEventMember } = await supabase
      .from("event_members")
      .select("user_id, role, status")
      .eq("event_id", eventId)
      .eq("user_id", body.invitee_user_id)
      .eq("role", "Participant")
      .maybeSingle();

    if (!targetEventMember) {
      throw new NotFoundError("That user is not a registered participant in this event.");
    }

    // ── 5. Target must not already be in a team for this event ────────────
    const { data: alreadyTeamed } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("event_id", eventId)
      .eq("user_id", body.invitee_user_id)
      .maybeSingle();

    if (alreadyTeamed) {
      throw new ConflictError("That participant is already in a team for this event.");
    }

    // ── 6. No duplicate pending invite ────────────────────────────────────
    const { data: existing } = await service
      .from("team_invitations")
      .select("id, status")
      .eq("team_id", teamId)
      .eq("invitee_user_id", body.invitee_user_id)
      .in("status", ["pending", "Pending"])
      .maybeSingle();

    if (existing) {
      throw new ConflictError("A pending invitation already exists for this participant.");
    }

    // ── 7. Create the invitation ──────────────────────────────────────────
    const { data: invite, error } = await service
      .from("team_invitations")
      .insert({
        team_id: teamId,
        event_id: eventId,
        inviter_user_id: user!.id,
        invitee_user_id: body.invitee_user_id,
        message: body.message,
        status: "pending",
        inviter_role: senderIsCaptain ? "Captain" : "Member",
        // Legacy column: event_member_id — set to invitee's event_members row if available
        event_member_id:
          (
            await service
              .from("event_members")
              .select("id")
              .eq("event_id", eventId)
              .eq("user_id", body.invitee_user_id)
              .maybeSingle()
          ).data?.id ?? null,
        invited_by: user!.id,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ConflictError("An invitation already exists.");
      }
      throw error;
    }

    return createdResponse({
      id: invite.id,
      team_name: team.name,
      invited_by_role: senderIsCaptain ? "Captain" : "Member",
    });
  },
);

export const GET = apiHandler({ requireAuth: true }, async ({ params, user }) => {
  const { id: eventId, teamId } = params as { id: string; teamId: string };
  const supabase = await createServerClient();

  // Must be a member to view invitations
  const { data: senderMembership } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!senderMembership) {
    throw new ForbiddenError("You must be a team member to view invitations.");
  }

  const { data: team } = await supabase
    .from("teams")
    .select("captain_id")
    .eq("id", teamId)
    .eq("event_id", eventId)
    .single();

  if (!team) throw new NotFoundError("Team not found.");

  const isCaptain = team.captain_id === user!.id;

  // Captains see all; members see only their own sent invitations
  let query = supabase
    .from("team_invitations")
    .select(
      "id, invitee_user_id, inviter_user_id, inviter_role, message, status, created_at, responded_at",
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (!isCaptain) {
    query = query.eq("inviter_user_id", user!.id);
  }

  const { data: invitations } = await query;

  // Enrich with display names (invitee + inviter)
  const allUserIds = [
    ...new Set(
      [
        ...(invitations ?? []).map((i) => i.invitee_user_id),
        ...(invitations ?? []).map((i) => i.inviter_user_id),
      ].filter(Boolean),
    ),
  ];

  const { data: users } =
    allUserIds.length > 0
      ? await supabase.from("users").select("id, display_name").in("id", allUserIds)
      : { data: [] };

  const usersMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));

  return okResponse(
    (invitations ?? []).map((i) => ({
      id: i.id,
      invitee_user_id: i.invitee_user_id,
      invitee_display_name: usersMap.get(i.invitee_user_id) ?? "Unknown",
      inviter_user_id: i.inviter_user_id,
      inviter_display_name: usersMap.get(i.inviter_user_id) ?? "Unknown",
      inviter_role: i.inviter_role,
      message: i.message ?? "",
      status: i.status,
      created_at: i.created_at,
      responded_at: i.responded_at,
    })),
  );
});
