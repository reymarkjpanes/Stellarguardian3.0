/**
 * Event winners sub-resource (Req 12.3).
 *
 * GET /api/events/[id]/winners — cursor-paginated list
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
      .from("winners")
      .select("*", { count: "exact" })
      .eq("event_id", eventId)
      .order("prize_amount", { ascending: false })
      .limit(limit);

    if (cursor) query = query.lt("prize_amount", cursor);

    const { data, error, count } = await query;

    if (error) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch winners." } },
        { status: 500 },
      );
    }

    const winners = data ?? [];
    const hasMore = winners.length === limit;
    const nextCursor = hasMore ? String(winners[winners.length - 1]?.prize_amount) : null;

    return paginatedResponse(winners, { cursor: nextCursor, hasMore, total: count ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
