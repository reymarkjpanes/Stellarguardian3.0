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
    .select("id, state, version, organizer_id, workspace_id, team_size_min, registration_deadline, review_window_hours")
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

  const isOrgOrAdmin = membership?.role === "Organizer" || membership?.role === "Judge";
  if (!isOrgOrAdmin && event.organizer_id !== user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only event organizer can change state." } },
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

  const ctx: EventRuleContext = {
    judgeCount: judgeCount ?? 0,
    registrationDeadline: event.registration_deadline ?? undefined,
    teamSizeMin: event.team_size_min ?? undefined,
    hasSubmissions: (submissionCount ?? 0) > 0,
    allSubmissionsScored: false, // TODO: compute from evaluations
    escrowFullyFundedOnChain: escrow?.state === "FullyFunded" || escrow?.state === "Locked",
    reviewWindowElapsed: false, // TODO: compute from timestamps
    unresolvedDisputes: unresolvedDisputes ?? 0,
    registrationCount: registrationCount ?? 0,
    submissionCount: submissionCount ?? 0,
    kycRequirementsSatisfied: true, // TODO: check workspace policies
    minimumParticipantsMet: true, // TODO: compute dynamically
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

  if (error || !updated) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "Event was modified concurrently." } },
      { status: 409 },
    );
  }

  return NextResponse.json({ data: updated });
}
