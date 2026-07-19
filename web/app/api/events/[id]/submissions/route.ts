/**
 * Event submissions sub-resource (Req 12.3, 12.4).
 *
 * GET  /api/events/[id]/submissions — cursor-paginated list
 * POST /api/events/[id]/submissions — create a submission
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

const CreateSubmissionSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(10000),
  project_url: z.string().url().optional(),
});

/**
 * POST /api/events/[id]/submissions — Create a submission.
 * Only participants can submit, and only during SubmissionOpen state.
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

    // Verify participant role
    const { data: membership } = await supabase
      .from("event_members")
      .select("role, status")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("role", "Participant")
      .eq("status", "accepted")
      .maybeSingle();

    if (!membership) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Only accepted participants can submit." } },
        { status: 403 },
      );
    }

    // Verify event is in SubmissionOpen state
    const { data: event } = await supabase
      .from("events")
      .select("state")
      .eq("id", eventId)
      .single();

    if (!event || event.state !== "SubmissionOpen") {
      return Response.json(
        { error: { code: "CONFLICT", message: `Submissions are not open. Current state: ${event?.state ?? "unknown"}.` } },
        { status: 409 },
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = CreateSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid submission data.",
            details: { fieldErrors: z.flattenError(parsed.error).fieldErrors },
          },
        },
        { status: 422 },
      );
    }

    // Check if user has a team in this event
    const { data: teamMembership } = await supabase
      .from("team_members")
      .select("team_id, teams!inner(event_id)")
      .eq("user_id", user.id)
      .maybeSingle();

    let teamId: string | null = null;
    if (teamMembership) {
      const teamEvent = (teamMembership as Record<string, unknown>).teams as { event_id: string } | null;
      if (teamEvent?.event_id === eventId) {
        teamId = teamMembership.team_id;
      }
    }

    // Create the submission + first version (content is in submission_versions table)
    const { data: submission, error: insertError } = await supabase
      .from("submissions")
      .insert({
        event_id: eventId,
        team_id: teamId,
        submitter_id: user.id,
        status: "Submitted",
        current_version: 1,
      })
      .select()
      .single();

    if (insertError) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: insertError.message } },
        { status: 500 },
      );
    }

    // Create the version record with content
    const { error: versionError } = await supabase
      .from("submission_versions")
      .insert({
        submission_id: submission.id,
        version_no: 1,
        content: {
          title: parsed.data.title,
          description: parsed.data.description,
          projectUrl: parsed.data.project_url ?? null,
        },
        actor_id: user.id,
      });

    if (versionError) {
      // Rollback submission if version creation fails
      await supabase.from("submissions").delete().eq("id", submission.id);
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: versionError.message } },
        { status: 500 },
      );
    }

    return okResponse(submission);
  } catch (error) {
    return handleApiError(error);
  }
}
