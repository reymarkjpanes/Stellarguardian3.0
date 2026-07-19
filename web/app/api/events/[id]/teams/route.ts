/**
 * Event teams sub-resource (Req 12.3).
 *
 * GET /api/events/[id]/teams — cursor-paginated list
 */
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/errors/responses";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
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
  } catch (error) {
    return handleApiError(error);
  }
}
