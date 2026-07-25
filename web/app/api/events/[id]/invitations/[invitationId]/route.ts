/**
 * PATCH /api/events/[id]/invitations/[invitationId]
 *
 * Invitee accepts or declines a team invitation.
 *
 * On accept:
 *   - Adds the user to team_members (DB trigger sets event_id automatically)
 *   - Marks the invitation as accepted
 *   - Cancels all other pending invitations for this user in this event
 *   - Cancels all pending join requests this user sent to other teams
 *
 * On decline:
 *   - Marks the invitation declined; the team can send another invite later.
 *
 * Reason for cascade cancel: once a participant joins a team, all their
 * outstanding outreach (requests they sent, invitations they received) is
 * no longer valid. This keeps state clean without manual intervention.
 */
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { okResponse } from "@/lib/errors/responses";
import { ForbiddenError, NotFoundError, BadRequestError } from "@/lib/errors";

const RespondSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export const PATCH = apiHandler(
  { requireAuth: true, schema: RespondSchema },
  async ({ params, user, body }) => {
    const { id: eventId, invitationId } = params as {
      id: string;
      invitationId: string;
    };
    const supabase = await createServerClient();
    const service = createServiceClient();

    // ── 1. Load the invitation ────────────────────────────────────────────
    const { data: invite } = await service
      .from("team_invitations")
      .select("id, team_id, event_id, invitee_user_id, status, teams(name)")
      .eq("id", invitationId)
      .single();

    if (!invite) throw new NotFoundError("Invitation not found.");
    if (invite.invitee_user_id !== user!.id) {
      throw new ForbiddenError("This invitation is not addressed to you.");
    }

    const statusLower = (invite.status as string).toLowerCase();
    if (statusLower !== "pending") {
      throw new BadRequestError(`This invitation has already been ${statusLower}.`);
    }

    // ── 2. Decline path ───────────────────────────────────────────────────
    if (body.action === "decline") {
      await service
        .from("team_invitations")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", invitationId);

      return okResponse({ action: "declined", team_id: invite.team_id });
    }

    // ── 3. Accept path ────────────────────────────────────────────────────

    // Guard: user must not already be in a team for this event
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("event_id", invite.event_id ?? eventId)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (existingMember) {
      throw new BadRequestError(
        "You are already in a team for this event. Leave your current team first.",
      );
    }

    // Add to team (trigger will auto-set event_id from teams table)
    const { error: memberError } = await service.from("team_members").insert({
      team_id: invite.team_id,
      user_id: user!.id,
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      // Unique index violation = already a member
      if (memberError.code === "23505") {
        throw new BadRequestError("You are already a member of this team.");
      }
      throw memberError;
    }

    // Mark this invitation accepted
    await service
      .from("team_invitations")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", invitationId);

    // Cancel all other pending invitations for this user in this event
    await service
      .from("team_invitations")
      .update({ status: "cancelled" })
      .eq("invitee_user_id", user!.id)
      .eq("event_id", invite.event_id ?? eventId)
      .in("status", ["pending", "Pending"])
      .neq("id", invitationId);

    // Cancel all pending join requests this user sent to other teams in this event
    const { data: teamIds } = await service
      .from("teams")
      .select("id")
      .eq("event_id", invite.event_id ?? eventId);

    const otherTeamIds = (teamIds ?? []).map((t) => t.id).filter((id) => id !== invite.team_id);

    if (otherTeamIds.length > 0) {
      await service
        .from("team_join_requests")
        .update({ status: "rejected" })
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .in("team_id", otherTeamIds);
    }

    return okResponse({
      action: "accepted",
      team_id: invite.team_id,
      team_name: (invite.teams as unknown as { name: string } | null)?.name ?? "Your Team",
    });
  },
);
