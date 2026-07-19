/**
 * Event members sub-resource (Req 12.3, 12.4).
 *
 * GET /api/events/[id]/members — cursor-paginated list
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
    const role = url.searchParams.get("role");

    let query = supabase
      .from("event_members")
      .select("*, users!inner(display_name, email)", { count: "exact" })
      .eq("event_id", eventId)
      .order("user_id")
      .limit(limit);

    if (role) query = query.eq("role", role);
    if (cursor) query = query.gt("user_id", cursor);

    const { data, error, count } = await query;

    if (error) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch members." } },
        { status: 500 },
      );
    }

    const members = data ?? [];
    const hasMore = members.length === limit;
    const nextCursor = hasMore ? members[members.length - 1]?.user_id : null;

    return paginatedResponse(members, { cursor: nextCursor, hasMore, total: count ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
