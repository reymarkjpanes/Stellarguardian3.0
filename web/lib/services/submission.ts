/**
 * Submission Draft and Versioning Service (Req 15.1-15.6, 30.1-30.3, 30.8).
 *
 * Supports Draft/Submitted states. Drafts are hidden from judges/organizer
 * and freely editable. Submitted entries are locked and revert only while
 * SubmissionOpen. Auto-finalizes drafts on SubmissionClosed. Appends immutable
 * version rows with incrementing numbers and diff summaries.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { writeAuditRecord } from "./audit";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";

export type SubmissionStatus = "Draft" | "Submitted";

/**
 * Create a new submission (Req 15.1).
 */
export async function createSubmission(params: {
  eventId: string;
  submitterId: string;
  teamId?: string;
  content: Record<string, unknown>;
}): Promise<{ id: string; status: SubmissionStatus }> {
  const supabase = createServiceClient();

  // Verify event is accepting submissions
  const { data: event } = await supabase
    .from("events")
    .select("state")
    .eq("id", params.eventId)
    .single();

  if (!event) throw new NotFoundError("Event not found.");
  if (event.state !== "SubmissionOpen") {
    throw new BadRequestError("Submissions can only be created while submissions are open.");
  }

  const { data: submission, error } = await supabase
    .from("submissions")
    .insert({
      event_id: params.eventId,
      submitter_id: params.submitterId,
      team_id: params.teamId ?? null,
      status: "Draft",
      current_version: 1,
      version: 0,
    })
    .select("id, status")
    .single();

  if (error) throw new Error(`Failed to create submission: ${error.message}`);

  // Create initial version row (Req 30.2)
  await supabase.from("submission_versions").insert({
    submission_id: submission.id,
    version_no: 1,
    content: params.content,
    diff_summary: { type: "initial", changes: [] },
    actor_id: params.submitterId,
  });

  await writeAuditRecord({
    action: "submission.create",
    actor_id: params.submitterId,
    event_id: params.eventId,
    resource_type: "submissions",
    resource_id: submission.id,
  });

  return { id: submission.id, status: submission.status as SubmissionStatus };
}

/**
 * Update a draft submission (Req 15.3). Only drafts are editable.
 */
export async function updateSubmission(params: {
  submissionId: string;
  actorId: string;
  content: Record<string, unknown>;
}): Promise<{ versionNo: number }> {
  const supabase = createServiceClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, status, current_version, submitter_id, team_id, event_id")
    .eq("id", params.submissionId)
    .single();

  if (!submission) throw new NotFoundError("Submission not found.");

  // Drafts are freely editable (Req 15.3)
  if (submission.status !== "Draft") {
    throw new BadRequestError("Only draft submissions can be edited (Req 15.3).");
  }

  // Verify actor has edit access (submitter or team member)
  const hasAccess = await verifyEditAccess(params.actorId, submission);
  if (!hasAccess) {
    throw new ForbiddenError("You do not have edit access to this submission.");
  }

  const newVersionNo = submission.current_version + 1;

  // Get previous content for diff
  const { data: prevVersion } = await supabase
    .from("submission_versions")
    .select("content")
    .eq("submission_id", params.submissionId)
    .eq("version_no", submission.current_version)
    .single();

  const diffSummary = computeDiffSummary(
    prevVersion?.content as Record<string, unknown> | null,
    params.content,
  );

  // Append new version row (Req 30.2)
  await supabase.from("submission_versions").insert({
    submission_id: params.submissionId,
    version_no: newVersionNo,
    content: params.content,
    diff_summary: diffSummary,
    actor_id: params.actorId,
  });

  // Update submission's current version
  await supabase
    .from("submissions")
    .update({ current_version: newVersionNo, updated_at: new Date().toISOString() })
    .eq("id", params.submissionId);

  await writeAuditRecord({
    action: "submission.update",
    actor_id: params.actorId,
    event_id: submission.event_id,
    resource_type: "submissions",
    resource_id: params.submissionId,
    metadata: { version_no: newVersionNo },
  });

  return { versionNo: newVersionNo };
}

/**
 * Submit (finalize) a draft (Req 15.4). Locks the submission.
 */
export async function submitSubmission(params: {
  submissionId: string;
  actorId: string;
}): Promise<void> {
  const supabase = createServiceClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, status, event_id, submitter_id, team_id")
    .eq("id", params.submissionId)
    .single();

  if (!submission) throw new NotFoundError("Submission not found.");
  if (submission.status !== "Draft") {
    throw new BadRequestError("Submission is already submitted.");
  }

  const hasAccess = await verifyEditAccess(params.actorId, submission);
  if (!hasAccess) throw new ForbiddenError("You do not have access to submit this.");

  await supabase
    .from("submissions")
    .update({ status: "Submitted", updated_at: new Date().toISOString() })
    .eq("id", params.submissionId);
}

/**
 * Revert a submitted entry to draft (Req 15.5). Only while SubmissionOpen.
 */
export async function revertSubmission(params: {
  submissionId: string;
  actorId: string;
}): Promise<void> {
  const supabase = createServiceClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, status, event_id, submitter_id, team_id")
    .eq("id", params.submissionId)
    .single();

  if (!submission) throw new NotFoundError("Submission not found.");
  if (submission.status !== "Submitted") {
    throw new BadRequestError("Only submitted entries can be reverted.");
  }

  // Check event state allows reverting (Req 15.5)
  const { data: event } = await supabase
    .from("events")
    .select("state")
    .eq("id", submission.event_id)
    .single();

  if (!event || event.state !== "SubmissionOpen") {
    throw new BadRequestError(
      "Submissions can only be reverted while submissions are open (Req 15.5).",
    );
  }

  const hasAccess = await verifyEditAccess(params.actorId, submission);
  if (!hasAccess) throw new ForbiddenError("You do not have access to revert this.");

  await supabase
    .from("submissions")
    .update({ status: "Draft", updated_at: new Date().toISOString() })
    .eq("id", params.submissionId);
}

/**
 * Auto-finalize all drafts on SubmissionClosed (Req 15.6).
 */
export async function autoFinalizeSubmissions(eventId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("submissions")
    .update({ status: "Submitted", updated_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("status", "Draft")
    .select("id");

  if (error) throw new Error(`Auto-finalize failed: ${error.message}`);
  return data?.length ?? 0;
}

/** Verify the actor has edit access to the submission. */
async function verifyEditAccess(
  actorId: string,
  submission: { submitter_id: string; team_id: string | null },
): Promise<boolean> {
  if (submission.submitter_id === actorId) return true;

  if (submission.team_id) {
    const supabase = createServiceClient();
    const { data: membership } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", submission.team_id)
      .eq("user_id", actorId)
      .maybeSingle();
    return !!membership;
  }

  return false;
}

/** Compute a simple diff summary between two content objects (Req 30.8). */
function computeDiffSummary(
  prev: Record<string, unknown> | null,
  next: Record<string, unknown>,
): Record<string, unknown> {
  if (!prev) return { type: "initial", changes: [] };

  const changes: Array<{ field: string; action: "added" | "modified" | "removed" }> = [];
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    if (!(key in prev)) {
      changes.push({ field: key, action: "added" });
    } else if (!(key in next)) {
      changes.push({ field: key, action: "removed" });
    } else if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
      changes.push({ field: key, action: "modified" });
    }
  }

  return { type: "diff", changes, fieldCount: changes.length };
}
