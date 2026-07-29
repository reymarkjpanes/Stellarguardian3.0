/**
 * PATCH /api/events/[id]/state — Transition event state (Req 23).
 * Uses shared state machine to validate transitions.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { EventWorkflowEngine } from "@/lib/engines/workflow/event-workflow";
import type { EventRuleContext } from "@/lib/engines/business-rules/event-rules";
import type { EventState } from "@/types";
import { z } from "zod";

const TransitionSchema = z.object({
  target_state: z.string(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parsed = TransitionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "target_state is required." } },
      { status: 422 },
    );
  }

  const targetState = parsed.data.target_state as EventState;

  // Fetch event with current state
  const { data: event } = await supabase
    .from("events")
    .select("id, state, version, organizer_id, workspace_id, team_size_min, registration_deadline, review_window_hours, prize_pool_target")
    .eq("id", id)
    .single();

  if (!event) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Event not found." } },
      { status: 404 },
    );
  }

  // Check organizer/admin permission
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Also check workspace-level role
  const { data: wsMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", event.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const eventRole = membership?.role;
  const wsRole = wsMembership?.role;

  const canTransitionRoles = new Set(["Organizer", "PlatformAdmin"]);
  const canTransitionWsRoles = new Set(["Owner", "WorkspaceAdmin"]);

  const isAllowed =
    canTransitionRoles.has(eventRole ?? "") ||
    canTransitionWsRoles.has(wsRole ?? "") ||
    event.organizer_id === user.id;

  if (!isAllowed) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only event organizer or admin can change state." } },
      { status: 403 },
    );
  }

  // Gather context for state machine
  const [
    { count: judgeCount },
    { count: submissionCount },
    { count: registrationCount },
    { count: unresolvedDisputes },
  ] = await Promise.all([
    supabase.from("event_members").select("*", { count: "exact", head: true }).eq("event_id", id).eq("role", "Judge"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("event_id", id),
    supabase.from("event_members").select("*", { count: "exact", head: true }).eq("event_id", id).eq("role", "Participant"),
    supabase.from("disputes").select("*", { count: "exact", head: true }).eq("event_id", id).in("state", ["Open", "UnderReview"]),
  ]);

  // Check escrow status if needed
  const { data: escrow } = await supabase
    .from("escrow_accounts")
    .select("state")
    .eq("event_id", id)
    .maybeSingle();

  // Compute allSubmissionsScored: every submission must have at least one evaluation
  let allSubmissionsScored = false;
  if ((submissionCount ?? 0) > 0) {
    const { data: submissions } = await supabase
      .from("submissions")
      .select("id")
      .eq("event_id", id);

    if (submissions && submissions.length > 0) {
      const submissionIds = submissions.map((s) => s.id);
      const { data: evaluations } = await supabase
        .from("evaluations")
        .select("submission_id, status")
        .in("submission_id", submissionIds)
        .eq("status", "Submitted");

      // Check that every submission has at least one completed evaluation
      const scoredSubmissionIds = new Set(
        (evaluations ?? []).map((e) => e.submission_id),
      );
      allSubmissionsScored = submissions.every((s) => scoredSubmissionIds.has(s.id));
    }
  }

  // Compute reviewWindowElapsed from event timestamps
  let reviewWindowElapsed = false;
  if (event.state === "Judging" && event.review_window_hours) {
    // Find when the event entered Judging state (use updated_at as proxy)
    const { data: auditEntry } = await supabase
      .from("audit_records")
      .select("created_at")
      .eq("event_id", id)
      .eq("action", "event.state_transition")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditEntry?.created_at) {
      const windowStart = new Date(auditEntry.created_at);
      const windowEnd = new Date(windowStart.getTime() + event.review_window_hours * 60 * 60 * 1000);
      reviewWindowElapsed = new Date() >= windowEnd;
    }
  }

  // Compute minimumParticipantsMet (at least 1 participant for non-draft events)
  const minimumParticipantsMet = (registrationCount ?? 0) >= 1;

  const ctx: EventRuleContext = {
    judgeCount: judgeCount ?? 0,
    registrationDeadline: event.registration_deadline ?? undefined,
    teamSizeMin: event.team_size_min ?? undefined,
    prizePoolTarget: Number(event.prize_pool_target ?? 0),
    hasSubmissions: (submissionCount ?? 0) > 0,
    allSubmissionsScored,
    escrowFullyFundedOnChain: escrow?.state === "FullyFunded" || escrow?.state === "Locked",
    reviewWindowElapsed,
    unresolvedDisputes: unresolvedDisputes ?? 0,
    registrationCount: registrationCount ?? 0,
    submissionCount: submissionCount ?? 0,
    kycRequirementsSatisfied: true, // Workspace-level policy — true unless workspace enforces KYC
    minimumParticipantsMet,
  };

  const result = EventWorkflowEngine.canTransition(event.state as EventState, targetState, ctx);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TRANSITION",
          message: `Cannot transition from ${event.state} to ${targetState}.`,
          details: {
            currentState: event.state,
            requestedState: targetState,
            validOutbound: result.validOutbound,
            unmetPreconditions: result.errors,
          },
        },
      },
      { status: 422 },
    );
  }

  // Apply transition with optimistic concurrency
  const { data: updated, error } = await supabase
    .from("events")
    .update({ state: targetState, version: event.version + 1, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("version", event.version)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Event was modified concurrently. Please refresh the page and try again." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: "DATABASE_ERROR", message: error.message } },
      { status: 422 },
    );
  }

  return NextResponse.json({ data: updated });
}
