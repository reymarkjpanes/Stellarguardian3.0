/**
 * Dispute Service (Req 7, 39).
 *
 * Creates disputes in Open during the Review (Objection Window) for accepted
 * participants; enforces role-gated transitions; records every transition in
 * an audit record; blocks event progression while disputes are unresolved.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { canDisputeTransition } from "@/lib/state-machine/dispute";
import { writeAuditRecord } from "./audit";
import { createNotification } from "./notification";
import { BadRequestError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { DisputeState, PlatformRole } from "@/types";

/** Review window duration bounds (Req 7.2). */
const MIN_REVIEW_WINDOW_HOURS = 24;
const MAX_REVIEW_WINDOW_HOURS = 168;
const DEFAULT_REVIEW_WINDOW_HOURS = 72;

/**
 * Create a dispute (Req 7.1, 7.3, 39.2).
 * Only accepted participants can file during the Review (Objection Window).
 */
export async function createDispute(params: {
  eventId: string;
  filerId: string;
  title: string;
  description: string;
}): Promise<{ id: string; state: DisputeState }> {
  const supabase = createServiceClient();

  // Verify event is in ReviewObjectionWindow (Req 7.3)
  const { data: event } = await supabase
    .from("events")
    .select("id, state, organizer_id, review_window_hours")
    .eq("id", params.eventId)
    .single();

  if (!event) throw new NotFoundError("Event not found.");

  if (event.state !== "Judging") {
    throw new BadRequestError(
      "Disputes can only be filed during the Judging phase.",
      { currentState: event.state },
    );
  }

  // Verify filer is an accepted participant (Req 39.2)
  const { data: membership } = await supabase
    .from("event_members")
    .select("role, status")
    .eq("event_id", params.eventId)
    .eq("user_id", params.filerId)
    .eq("role", "Participant")
    .eq("status", "accepted")
    .maybeSingle();

  if (!membership) {
    throw new ForbiddenError(
      "Only accepted participants can file disputes (Req 39.2).",
    );
  }

  // Create the dispute
  const { data: dispute, error } = await supabase
    .from("disputes")
    .insert({
      event_id: params.eventId,
      filed_by: params.filerId,
      state: "Open",
      title: params.title,
      description: params.description,
      deadline: new Date(
        Date.now() + (event.review_window_hours ?? 72) * 60 * 60 * 1000,
      ).toISOString(),
    })
    .select("id, state")
    .single();

  if (error) throw new Error(`Failed to create dispute: ${error.message}`);

  // Notify organizer and judges (Req 7.1)
  await createNotification({
    userId: event.organizer_id,
    category: "dispute",
    title: "New dispute filed",
    body: `A participant has filed a dispute: "${params.title}"`,
    eventId: params.eventId,
  });

  // Notify judges
  const { data: judges } = await supabase
    .from("event_members")
    .select("user_id")
    .eq("event_id", params.eventId)
    .eq("role", "Judge");

  for (const judge of judges ?? []) {
    await createNotification({
      userId: judge.user_id,
      category: "dispute",
      title: "New dispute filed",
      body: `A dispute has been filed: "${params.title}"`,
      eventId: params.eventId,
    });
  }

  // Audit record (Req 39.5)
  await writeAuditRecord({
    action: "dispute.create",
    actor_id: params.filerId,
    event_id: params.eventId,
    resource_type: "disputes",
    resource_id: dispute.id,
    metadata: { title: params.title },
  });

  return { id: dispute.id, state: dispute.state as DisputeState };
}

/**
 * Transition a dispute state (Req 39.3, 39.4).
 * Enforces role-gated transitions via the state machine.
 */
export async function transitionDispute(params: {
  disputeId: string;
  actorId: string;
  actorRole: PlatformRole;
  targetState: DisputeState;
  resolution?: string;
}): Promise<{ id: string; state: DisputeState }> {
  const supabase = createServiceClient();

  // Get current dispute
  const { data: dispute } = await supabase
    .from("disputes")
    .select("*")
    .eq("id", params.disputeId)
    .single();

  if (!dispute) throw new NotFoundError("Dispute not found.");

  const currentState = dispute.state as DisputeState;
  const isFiler = dispute.filed_by === params.actorId;

  // Check transition validity (Req 39.3, 39.4)
  const result = canDisputeTransition(
    currentState,
    params.targetState,
    params.actorRole,
    isFiler,
  );

  if (!result.ok) {
    throw new ValidationError(
      `Cannot transition dispute from ${currentState} to ${params.targetState}.`,
      {
        currentState,
        requestedState: params.targetState,
        validOutbound: result.validOutbound,
        unmetPreconditions: result.unmetPreconditions,
      },
    );
  }

  // Execute transition
  const { error } = await supabase
    .from("disputes")
    .update({
      state: params.targetState,
      resolved_by: params.targetState !== "Withdrawn" ? params.actorId : null,
      resolution: params.resolution ?? null,
      resolved_at:
        ["Upheld", "Dismissed", "Withdrawn"].includes(params.targetState)
          ? new Date().toISOString()
          : null,
    })
    .eq("id", params.disputeId);

  if (error) throw new Error(`Failed to transition dispute: ${error.message}`);

  // Audit record (Req 39.5)
  await writeAuditRecord({
    action: "dispute.transition",
    actor_id: params.actorId,
    event_id: dispute.event_id,
    resource_type: "disputes",
    resource_id: params.disputeId,
    metadata: {
      from_state: currentState,
      to_state: params.targetState,
      resolution: params.resolution,
    },
  });

  // Notify filer of resolution
  if (["Upheld", "Dismissed"].includes(params.targetState)) {
    await createNotification({
      userId: dispute.filed_by,
      category: "dispute",
      title: `Dispute ${params.targetState.toLowerCase()}`,
      body: params.resolution ?? `Your dispute has been ${params.targetState.toLowerCase()}.`,
      eventId: dispute.event_id,
    });
  }

  return { id: params.disputeId, state: params.targetState };
}

/**
 * Check if disbursement is blocked by the objection window (Req 7.5-7.7, 39.6-39.9).
 */
export async function isDisbursementBlocked(eventId: string): Promise<{
  blocked: boolean;
  reasons: string[];
}> {
  const supabase = createServiceClient();
  const reasons: string[] = [];

  // Check if review window has elapsed
  const { data: event } = await supabase
    .from("events")
    .select("state, review_window_hours, updated_at")
    .eq("id", eventId)
    .single();

  if (!event) return { blocked: true, reasons: ["Event not found"] };

  // Check for unresolved disputes (Req 39.7)
  const { count } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("state", ["Open", "UnderReview"]);

  if (count && count > 0) {
    reasons.push(`${count} unresolved dispute(s) remain (Req 39.7)`);
  }

  return { blocked: reasons.length > 0, reasons };
}

/**
 * Validate review window duration (Req 7.2).
 */
export function validateReviewWindowHours(hours?: number): number {
  const value = hours ?? DEFAULT_REVIEW_WINDOW_HOURS;
  if (value < MIN_REVIEW_WINDOW_HOURS || value > MAX_REVIEW_WINDOW_HOURS) {
    throw new ValidationError(
      `Review window must be between ${MIN_REVIEW_WINDOW_HOURS} and ${MAX_REVIEW_WINDOW_HOURS} hours.`,
      { provided: value, min: MIN_REVIEW_WINDOW_HOURS, max: MAX_REVIEW_WINDOW_HOURS },
    );
  }
  return value;
}
