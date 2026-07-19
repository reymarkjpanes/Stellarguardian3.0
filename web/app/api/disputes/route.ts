/**
 * Dispute lifecycle endpoint (Req 7, 39).
 *
 * POST /api/disputes — create a dispute
 * GET /api/disputes — list disputes (filtered by eventId)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { createdResponse, paginatedResponse } from "@/lib/errors/responses";
import { createDispute } from "@/lib/services/dispute";

const CreateDisputeSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = CreateDisputeSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid request body.",
            details: { fieldErrors: z.flattenError(parsed.error).fieldErrors },
          },
        },
        { status: 422 },
      );
    }

    const dispute = await createDispute({
      eventId: parsed.data.eventId,
      filerId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
    });

    return createdResponse(dispute);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId");
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);

    let query = supabase
      .from("disputes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (eventId) query = query.eq("event_id", eventId);
    if (cursor) query = query.lt("created_at", cursor);

    const { data, error, count } = await query;

    if (error) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch disputes." } },
        { status: 500 },
      );
    }

    const disputes = data ?? [];
    const hasMore = disputes.length === limit;
    const nextCursor = hasMore ? disputes[disputes.length - 1]?.created_at : null;

    return paginatedResponse(disputes, { cursor: nextCursor, hasMore, total: count ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
