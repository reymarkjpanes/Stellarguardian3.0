/**
 * Event members sub-resource (Req 12.3, 12.4).
 *
 * GET   /api/events/[id]/members — cursor-paginated list
 * PATCH /api/events/[id]/members — approve/reject a member application
 */
import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse, paginatedResponse } from "@/lib/errors/responses";

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

const MemberActionSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  action: z.enum(["approve", "reject"]),
});

/**
 * PATCH /api/events/[id]/members — Approve or reject a member application.
 * Only organizers can approve/reject members.
 */
export async function PATCH(
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

    // Verify caller is organizer
    const { data: callerMembership } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("role", "Organizer")
      .maybeSingle();

    if (!callerMembership) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Only organizers can approve/reject members." } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = MemberActionSchema.safeParse(body);

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

    const { user_id: targetUserId, action } = parsed.data;
    const newStatus = action === "approve" ? "accepted" : "rejected";

    const { data: updated, error: updateError } = await supabase
      .from("event_members")
      .update({ status: newStatus })
      .eq("event_id", eventId)
      .eq("user_id", targetUserId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (updateError) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: updateError.message } },
        { status: 500 },
      );
    }

    if (!updated) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "No pending membership found for this user." } },
        { status: 404 },
      );
    }

    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
