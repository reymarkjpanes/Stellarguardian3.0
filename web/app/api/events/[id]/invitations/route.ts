/**
 * GET /api/events/[id]/invitations
 *
 * Returns all pending team invitations addressed to the authenticated user
 * for this event. Used by the Teams tab to show the participant's inbox.
 *
 * Includes who sent the invite (display name + role: Captain/Member) so the
 * invitee understands who is reaching out — a captain invite carries more
 * signal than a member invite.
 */
import { apiHandler } from "@/lib/api-handler";
import { createServerClient } from "@/lib/supabase/server";
import { okResponse } from "@/lib/errors/responses";

export const GET = apiHandler({ requireAuth: true }, async ({ params, user }) => {
  const { id: eventId } = params as { id: string };
  const supabase = await createServerClient();

  // Fetch pending invitations for this user in this event
  const { data: invitations } = await supabase
    .from("team_invitations")
    .select(
      `
      id,
      team_id,
      inviter_user_id,
      inviter_role,
      message,
      status,
      created_at,
      teams ( name )
    `,
    )
    .eq("event_id", eventId)
    .eq("invitee_user_id", user!.id)
    .in("status", ["pending", "Pending"])
    .order("created_at", { ascending: false });

  if (!invitations || invitations.length === 0) {
    return okResponse([]);
  }

  // Enrich inviter display names
  const inviterIds = [...new Set(invitations.map((i) => i.inviter_user_id).filter(Boolean))];
  const { data: inviters } =
    inviterIds.length > 0
      ? await supabase.from("users").select("id, display_name").in("id", inviterIds)
      : { data: [] };

  const inviterMap = new Map((inviters ?? []).map((u) => [u.id, u.display_name]));

  return okResponse(
    invitations.map((i) => ({
      id: i.id,
      team_id: i.team_id,
      team_name: (i.teams as { name: string } | null)?.name ?? "Unknown Team",
      inviter_user_id: i.inviter_user_id,
      inviter_display_name: inviterMap.get(i.inviter_user_id) ?? "Unknown",
      inviter_role: (i.inviter_role as string) ?? "Captain",
      message: i.message ?? "",
      created_at: i.created_at,
    })),
  );
});
