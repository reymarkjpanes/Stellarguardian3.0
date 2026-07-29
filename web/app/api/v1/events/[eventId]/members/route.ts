/**
 * GET /api/v1/events/[eventId]/members
 *
 * Returns event members with optional filtering. Backed by Supabase so it
 * uses the same auth/RLS as the rest of the app — no raw postgres needed.
 *
 * Query params:
 *   cursor   — pagination cursor (last user_id from previous page)
 *   limit    — page size (default 20, max 50)
 *   role     — filter by role (e.g. "Participant", "Judge", "Organizer")
 *   status   — filter by membership status (e.g. "accepted", "pending")
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);

    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
    const role = searchParams.get("role") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    let query = supabase
      .from("event_members")
      .select("user_id, role, status, created_at", { count: "exact" })
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // fetch one extra to detect hasMore

    if (role) query = query.eq("role", role);
    if (status) query = query.eq("status", status);
    if (cursor) query = query.lt("created_at", cursor); // cursor = created_at of last item

    const { data: members, count, error } = await query;

    if (error) {
      console.error("[GET /api/v1/events/members] Supabase error:", error.message);
      return NextResponse.json(
        { success: false, error: "Failed to fetch members." },
        { status: 500 },
      );
    }

    const hasMore = (members?.length ?? 0) > limit;
    const items = hasMore ? members!.slice(0, limit) : (members ?? []);
    const nextCursor = hasMore ? items[items.length - 1]?.created_at : undefined;

    return NextResponse.json({
      success: true,
      data: items,
      metadata: {
        totalCount: count ?? 0,
        hasMore,
        nextCursor: nextCursor ?? null,
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/events/members] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
