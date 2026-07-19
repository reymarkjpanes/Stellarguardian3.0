/**
 * Teams API Routes
 *
 * GET /api/events/[id]/teams — cursor-paginated list
 */
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/api-handler";
import { paginatedResponse, createdResponse } from "@/lib/errors/responses";
import { CompetitionEngine } from "@/lib/engine/competition.engine";

export const GET = apiHandler({ requireAuth: false }, async ({ request, params }) => {
  const { id: eventId } = params as { id: string };
  const supabase = await createServerClient();
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);

  let query = supabase
    .from("teams")
    .select("id, name, captain_id, version, team_members(user_id, joined_at)", { count: "exact" })
    .eq("event_id", eventId)
    .order("name")
    .limit(limit);

  if (cursor) query = query.gt("name", cursor);

  const { data, error, count } = await query;

  if (error) {
    return Response.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch teams." } },
      { status: 500 },
    );
  }

  const teams = data ?? [];
  const hasMore = teams.length === limit;
  const nextCursor = hasMore ? teams[teams.length - 1]?.name : null;

  return paginatedResponse(teams, { cursor: nextCursor, hasMore, total: count ?? 0 });
});

const CreateTeamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters").max(50),
});

export const POST = apiHandler({ requireAuth: true, schema: CreateTeamSchema }, async ({ params, user, body }) => {
  const { id: eventId } = params as { id: string };
  const teamId = await CompetitionEngine.createTeam(eventId, user!.id, body.name);
  return createdResponse({ id: teamId, name: body.name });
});
