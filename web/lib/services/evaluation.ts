/**
 * Judging and Conflict-of-Interest Service (Req 11.1-11.5).
 *
 * Rejects scoring with CONFLICT_OF_INTEREST when the judge is a member of
 * the submitting team; excludes COI-flagged evaluations from averages;
 * prevents a user holding both Judge and Participant on one event.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { writeAuditRecord } from "./audit";
import { ForbiddenError, ConflictError } from "@/lib/errors";

/**
 * Check for conflict of interest (Req 11.1, 11.2).
 * Returns true if the judge is a member of the team that authored the submission.
 */
async function hasConflictOfInterest(judgeId: string, submissionId: string): Promise<boolean> {
  const supabase = createServiceClient();

  // Get submission's team
  const { data: submission } = await supabase
    .from("submissions")
    .select("team_id")
    .eq("id", submissionId)
    .single();

  if (!submission?.team_id) return false;

  // Check if judge is a member of that team
  const { data: membership } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", submission.team_id)
    .eq("user_id", judgeId)
    .maybeSingle();

  return !!membership;
}

/**
 * Create an evaluation / score submission (Req 11.1).
 * Rejects with CONFLICT_OF_INTEREST if the judge is on the team.
 */
export async function createEvaluation(params: {
  submissionId: string;
  judgeId: string;
  scores: Record<string, number>;
  eventId: string;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();

  // Check COI (Req 11.1, 11.2)
  const hasCoi = await hasConflictOfInterest(params.judgeId, params.submissionId);

  if (hasCoi) {
    // Log the COI rejection (Req 11.5)
    await writeAuditRecord({
      action: "evaluation.conflict_of_interest",
      actor_id: params.judgeId,
      event_id: params.eventId,
      resource_type: "evaluations",
      metadata: { submission_id: params.submissionId },
    });

    throw new ForbiddenError(
      "CONFLICT_OF_INTEREST: You cannot score a submission from your own team (Req 11.1).",
      { code: "CONFLICT_OF_INTEREST", submissionId: params.submissionId },
    );
  }

  // Check for duplicate evaluation
  const { data: existing } = await supabase
    .from("evaluations")
    .select("id")
    .eq("submission_id", params.submissionId)
    .eq("judge_id", params.judgeId)
    .maybeSingle();

  if (existing) {
    throw new ConflictError("You have already scored this submission.");
  }

  // Create the evaluation
  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      submission_id: params.submissionId,
      judge_id: params.judgeId,
      scores: params.scores,
      conflict_of_interest: false,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create evaluation: ${error.message}`);

  await writeAuditRecord({
    action: "evaluation.create",
    actor_id: params.judgeId,
    event_id: params.eventId,
    resource_type: "evaluations",
    resource_id: data.id,
    metadata: { submission_id: params.submissionId },
  });

  return { id: data.id };
}

/**
 * Get average scores for a submission, excluding COI-flagged evaluations (Req 11.4).
 */
export async function getSubmissionAverageScores(
  submissionId: string,
): Promise<{ averageScores: Record<string, number>; evaluationCount: number }> {
  const supabase = createServiceClient();

  const { data: evaluations } = await supabase
    .from("evaluations")
    .select("scores")
    .eq("submission_id", submissionId)
    .eq("conflict_of_interest", false);

  if (!evaluations || evaluations.length === 0) {
    return { averageScores: {}, evaluationCount: 0 };
  }

  const allKeys = new Set<string>();
  for (const evaluation of evaluations) {
    for (const key of Object.keys(evaluation.scores ?? {})) {
      allKeys.add(key);
    }
  }

  const averageScores: Record<string, number> = {};
  for (const key of allKeys) {
    const values = evaluations
      .map((e) => (e.scores as Record<string, number>)?.[key])
      .filter((v): v is number => v !== undefined);
    averageScores[key] = values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  return { averageScores, evaluationCount: evaluations.length };
}

/**
 * Verify judge/participant exclusivity (Req 11.3).
 * Prevents a user from holding both roles on one event.
 */
export async function validateRoleExclusivity(
  eventId: string,
  userId: string,
  requestedRole: "Judge" | "Participant",
): Promise<void> {
  const supabase = createServiceClient();
  const conflictRole = requestedRole === "Judge" ? "Participant" : "Judge";

  const { data: existing } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("role", conflictRole)
    .maybeSingle();

  if (existing) {
    throw new ConflictError(
      `A user cannot hold both Judge and Participant roles on one event (Req 11.3).`,
      { existingRole: conflictRole, requestedRole },
    );
  }
}
