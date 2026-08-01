/**
 * GET /api/v1/teams/[teamId]/submission/history?eventId=...
 *
 * Returns the submission activity timeline for a team's project.
 * Used by useSubmissionController to replace hardcoded mock activities.
 * Only team members and organizers can view.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const GET = withErrorHandling(async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await context.params;
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = request.nextUrl.searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    // Verify requester is a team member or event member
    const [{ data: teamMember }, { data: eventMember }] = await Promise.all([
      supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("event_members")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!teamMember && !eventMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch submission for this team/event
    const { data: submission } = await supabase
      .from("submissions")
      .select("id")
      .eq("team_id", teamId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (!submission) {
      return NextResponse.json({ success: true, data: { activities: [] } });
    }

    // Fetch history entries
    const { data: history } = await supabase
      .from("submission_history")
      .select("id, actor_id, action, details, created_at")
      .eq("submission_id", submission.id)
      .order("created_at", { ascending: false })
      .limit(30);

    // Enrich with actor display names
    const actorIds = [...new Set((history ?? []).map((h) => h.actor_id))];
    const { data: users } =
      actorIds.length > 0
        ? await supabase.from("users").select("id, display_name").in("id", actorIds)
        : { data: [] };

    const usersMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));

    const activities = (history ?? []).map((h) => ({
      id: h.id,
      action: h.action,
      details: h.details,
      actor_display_name: usersMap.get(h.actor_id) ?? "Unknown",
      created_at: h.created_at,
    }));

    return NextResponse.json({ success: true, data: { activities } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
});
