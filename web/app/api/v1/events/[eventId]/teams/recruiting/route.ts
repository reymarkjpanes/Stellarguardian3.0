/**
 * GET /api/v1/events/[eventId]/teams/recruiting
 *
 * Returns teams in "Recruiting" status for a given event — used by the team
 * discovery / matchmaking UI. Backed by Supabase so it shares the same
 * auth/RLS as the rest of the app.
 *
 * Query params:
 *   cursor   — pagination cursor (last team id from previous page)
 *   limit    — page size (default 20, max 50)
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const GET = withErrorHandling(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);

    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

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
      .from("teams")
      .select(
        `
        id,
        name,
        status,
        visibility,
        max_members,
        created_at,
        team_members(count)
      `,
        { count: "exact" },
      )
      .eq("event_id", eventId)
      .eq("status", "Recruiting")
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (cursor) query = query.lt("created_at", cursor);

    const { data: teams, count, error } = await query;

    if (error) {
      console.error("[GET /api/v1/events/teams/recruiting] Supabase error:", error.message);
      return NextResponse.json(
        { success: false, error: "Failed to fetch recruiting teams." },
        { status: 500 },
      );
    }

    const hasMore = (teams?.length ?? 0) > limit;
    const items = hasMore ? teams!.slice(0, limit) : (teams ?? []);
    const nextCursor = hasMore ? items[items.length - 1]?.created_at : undefined;

    const dtos = items.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      visibility: t.visibility,
      lookingForMembers: true,
      memberCount: Array.isArray(t.team_members) ? t.team_members.length : 0,
      maxMembers: t.max_members,
      createdAt: t.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: dtos,
      metadata: {
        totalCount: count ?? 0,
        hasMore,
        nextCursor: nextCursor ?? null,
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/events/teams/recruiting] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
});
