/**
 * GET /api/events/[id]/evaluations — List evaluations for event (judges/organizer only).
 * POST /api/events/[id]/evaluations — Submit an evaluation score (judges only).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

const CreateEvaluationSchema = z.object({
  submission_id: z.string().uuid(),
  scores: z.record(z.string(), z.number().min(0).max(100)),
  feedback: z.string().max(5000).optional(),
  conflict_of_interest: z.boolean().default(false),
});
export const GET = withErrorHandling(async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  // Check user is judge or organizer for this event
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["Judge", "Organizer"].includes(membership.role)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only judges and organizers can view evaluations." } },
      { status: 403 },
    );
  }

  const { data: evaluations } = await supabase
    .from("evaluations")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ data: evaluations ?? [] });
});
export const POST = withErrorHandling(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  // Must be a judge for this event
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .eq("role", "Judge")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only judges can submit evaluations." } },
      { status: 403 },
    );
  }

  // Event must be in Judging state
  const { data: event } = await supabase.from("events").select("state").eq("id", id).single();

  if (!event || event.state !== "Judging") {
    return NextResponse.json(
      { error: { code: "INVALID_STATE", message: "Event is not in Judging state." } },
      { status: 422 },
    );
  }

  const body = await request.json();
  const parsed = CreateEvaluationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input.",
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  // Check for existing evaluation (unique per judge + submission)
  const { data: existing } = await supabase
    .from("evaluations")
    .select("id")
    .eq("submission_id", parsed.data.submission_id)
    .eq("judge_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "You have already evaluated this submission." } },
      { status: 409 },
    );
  }

  const { data: evaluation, error } = await supabase
    .from("evaluations")
    .insert({
      event_id: id,
      submission_id: parsed.data.submission_id,
      judge_id: user.id,
      scores: parsed.data.scores,
      feedback: parsed.data.feedback ?? null,
      conflict_of_interest: parsed.data.conflict_of_interest,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: evaluation }, { status: 201 });
});
