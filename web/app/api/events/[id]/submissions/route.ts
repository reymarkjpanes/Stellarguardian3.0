/**
 * Submissions API Routes
 *
 * GET /api/events/[id]/submissions — list submissions
 * POST /api/events/[id]/submissions — create submission
 */
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/api-handler";
import { okResponse, paginatedResponse } from "@/lib/errors/responses";
import { CompetitionEngine } from "@/lib/engine/competition.engine";

export const GET = apiHandler({ requireAuth: false }, async ({ request, params }) => {
  const { id: eventId } = params as { id: string };
  const supabase = await createServerClient();
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const cursor = url.searchParams.get("cursor");

  let query = supabase
    .from("submissions")
    .select(
      `
        id,
        team_id,
        submitter_id,
        status,
        current_version,
        created_at,
        updated_at,
        teams(name),
        users(name, email)
      `,
      { count: "exact" },
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: submissions, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch submissions." } },
      { status: 500 },
    );
  }

  const nextCursor =
    submissions && submissions.length === limit
      ? submissions[submissions.length - 1]?.created_at
      : null;
  const hasMore = submissions?.length === limit;

  return paginatedResponse(submissions, { cursor: nextCursor, hasMore, total: count ?? 0 });
});

const CreateSubmissionSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(10, "Description must be at least 10 characters"),
  project_url: z.string().url("Invalid project URL").optional(),
});

export const POST = apiHandler({ requireAuth: true, schema: CreateSubmissionSchema }, async ({ params, user, body }) => {
  const { id: eventId } = params as { id: string };

  const { submissionId } = await CompetitionEngine.submitProject(eventId, user!.id, {
    title: body.title,
    description: body.description,
    projectUrl: body.project_url,
  });

  return okResponse({ id: submissionId, status: "Submitted" });
});
