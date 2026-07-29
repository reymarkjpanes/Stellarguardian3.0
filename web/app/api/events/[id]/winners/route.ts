/**
 * Event winners sub-resource (Req 12.3).
 *
 * GET  /api/events/[id]/winners — cursor-paginated list
 * POST /api/events/[id]/winners — assign winners (organizer only)
 */
import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse, paginatedResponse } from "@/lib/errors/responses";

const AssignWinnerSchema = z.object({
  recipient_id: z.string().uuid("Invalid recipient ID"),
  team_id: z.string().uuid("Invalid team ID").nullable().optional(),
  prize_amount: z.number().positive("Prize amount must be positive"),
});

const AssignWinnersSchema = z.object({
  winners: z.array(AssignWinnerSchema).min(1, "At least one winner required"),
});

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

/**
 * POST /api/events/[id]/winners — Assign winners.
 * Only organizers can assign winners when the event is in a judging or verification state.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    // Verify organizer role
    const { data: membership } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("role", "Organizer")
      .maybeSingle();

    if (!membership) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Only organizers can assign winners." } },
        { status: 403 },
      );
    }

    // Verify event state allows winner assignment
    const { data: event } = await supabase
      .from("events")
      .select("state")
      .eq("id", eventId)
      .single();

    const allowedStates = ["Judging"];
    if (!event || !allowedStates.includes(event.state)) {
      return Response.json(
        { error: { code: "CONFLICT", message: `Cannot assign winners in state: ${event?.state ?? "unknown"}.` } },
        { status: 409 },
      );
    }

    const body = await request.json();
    const parsed = AssignWinnersSchema.safeParse(body);

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

    // Insert winners
    const winnersToInsert = parsed.data.winners.map((w) => ({
      event_id: eventId,
      recipient_id: w.recipient_id,
      team_id: w.team_id ?? null,
      prize_amount: w.prize_amount,
      disbursement_status: "pending",
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("winners")
      .insert(winnersToInsert)
      .select();

    if (insertError) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: insertError.message } },
        { status: 500 },
      );
    }

    return okResponse(inserted);
  } catch (error) {
    return handleApiError(error);
  }
}
