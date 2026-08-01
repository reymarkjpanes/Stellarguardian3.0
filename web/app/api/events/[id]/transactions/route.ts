/**
 * Event transactions sub-resource (Req 12.3).
 *
 * GET /api/events/[id]/transactions — cursor-paginated list
 */
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/errors/responses";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const GET = withErrorHandling(async function GET(
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
      .from("transactions")
      .select("*", { count: "exact" })
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cursor) query = query.lt("created_at", cursor);

    const { data, error, count } = await query;

    if (error) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch transactions." } },
        { status: 500 },
      );
    }

    const transactions = data ?? [];
    const hasMore = transactions.length === limit;
    const nextCursor = hasMore ? transactions[transactions.length - 1]?.created_at : null;

    return paginatedResponse(transactions, { cursor: nextCursor, hasMore, total: count ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
});
