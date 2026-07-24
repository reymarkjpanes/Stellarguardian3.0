/**
 * GET /api/events/[id]/participants?q=&exclude_teamed=true
 *
 * Returns registered participants for this event, optionally filtered by
 * display name query and/or excluding participants already in a team.
 *
 * Used by: captain invite search, team member invite search.
 * Auth: any authenticated event member.
 */
import { apiHandler } from "@/lib/api-handler";
import { createServerClient } from "@/lib/supabase/server";
import { okResponse } from "@/lib/errors/responses";
import { ForbiddenError } from "@/lib/errors";

export const GET = apiHandler({ requireAuth: true }, async ({ request, params, user }) => {
  const { id: eventId } = params as { id: string };
  const supabase = await createServerClient();

  // Must be an event member to search participants
  const { data: myMembership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!myMembership) {
    throw new ForbiddenError("You must be registered in this event to search participants.");
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const excludeTeamed = url.searchParams.get("exclude_teamed") !== "false"; // default true

  // Get all registered participants
  const { data: members } = await supabase
    .from("event_members")
    .select("user_id, role")
    .eq("event_id", eventId)
    .eq("role", "Participant");

  const participantIds = (members ?? []).map((m) => m.user_id);
  if (participantIds.length === 0) return okResponse([]);

  // Fetch user display names
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name")
    .in("id", participantIds);

  let results = (users ?? []).filter((u) => u.id !== user!.id); // exclude self

  // Filter by name query
  if (q) {
    results = results.filter((u) => u.display_name.toLowerCase().includes(q));
  }

  // Exclude participants already in a team for this event
  if (excludeTeamed) {
    const { data: teamedUsers } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("event_id", eventId);

    const teamedSet = new Set((teamedUsers ?? []).map((t) => t.user_id));
    results = results.filter((u) => !teamedSet.has(u.id));
  }

  return okResponse(
    results.slice(0, 20).map((u) => ({
      user_id: u.id,
      display_name: u.display_name,
    })),
  );
});
