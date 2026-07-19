/**
 * Event submissions sub-resource (Req 12.3, 12.4).
 *
 * GET /api/events/[id]/submissions — cursor-paginated list
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
    const status = url.searchParams.get("status");

    let query = supabase
      .from("submissions")
      .select("id, event_id, team_id, submitter_id, status, current_version, updated_at", { count: "exact" })
      .eq("event_id", eventId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (cursor) query = query.lt("updated_at", cursor);

    const { data, error, count } = await query;

    if (error) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch submissions." } },
        { status: 500 },
      );
    }

    const submissions = data ?? [];
    const hasMore = submissions.length === limit;
    const nextCursor = hasMore ? submissions[submissions.length - 1]?.updated_at : null;

    return paginatedResponse(submissions, { cursor: nextCursor, hasMore, total: count ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
