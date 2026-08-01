/**
 * Comments API — M14
 *
 * GET  /api/comments?event_id=X or ?submission_id=X or ?dispute_id=X
 * POST /api/comments — create a comment
 */
import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

const CreateCommentSchema = z
  .object({
    event_id: z.string().uuid().optional(),
    submission_id: z.string().uuid().optional(),
    dispute_id: z.string().uuid().optional(),
    parent_id: z.string().uuid().optional(),
    body: z.string().min(1).max(5000),
  })
  .refine((d) => [d.event_id, d.submission_id, d.dispute_id].filter(Boolean).length === 1, {
    message: "Exactly one of event_id, submission_id, or dispute_id must be provided.",
  });
export const GET = withErrorHandling(async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Auth required." } },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const eventId = url.searchParams.get("event_id");
    const submissionId = url.searchParams.get("submission_id");
    const disputeId = url.searchParams.get("dispute_id");

    let query = supabase
      .from("comments")
      .select("*, users!comments_author_id_fkey(display_name)")
      .order("created_at", { ascending: true })
      .limit(100);

    if (eventId) query = query.eq("event_id", eventId);
    else if (submissionId) query = query.eq("submission_id", submissionId);
    else if (disputeId) query = query.eq("dispute_id", disputeId);
    else {
      return Response.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Provide event_id, submission_id, or dispute_id.",
          },
        },
        { status: 400 },
      );
    }

    const { data, error } = await query;
    if (error) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: error.message } },
        { status: 500 },
      );
    }

    return okResponse(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
});
export const POST = withErrorHandling(async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Auth required." } },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = CreateCommentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: parsed.error.issues[0]?.message ?? "Invalid input.",
          },
        },
        { status: 422 },
      );
    }

    const { data: comment, error: insertError } = await supabase
      .from("comments")
      .insert({
        ...parsed.data,
        author_id: user.id,
      })
      .select("*, users!comments_author_id_fkey(display_name)")
      .single();

    if (insertError) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: insertError.message } },
        { status: 500 },
      );
    }

    return okResponse(comment);
  } catch (error) {
    return handleApiError(error);
  }
});
