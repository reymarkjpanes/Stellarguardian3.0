"use server";

import { createServerClient as createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { EvaluationScores } from "@/src/domains/judging/domain/EvaluationAggregate";

export async function saveEvaluationDraftAction(
  evaluationId: string,
  scores: EvaluationScores,
  draftNotes: string | undefined,
  expectedVersion: number,
  eventId: string,
  _submissionId: string, // reserved for future per-submission audit logging
) {
  const supabase = await createClient();

  // We bypass the repository in Server Actions for simplicity,
  // or we could construct EvaluationRepository here.
  // Given we just need the RPC, direct call is fine.
  const { error } = await supabase.rpc("save_draft_evaluation", {
    p_eval_id: evaluationId,
    p_scores_json: scores as unknown as Record<string, unknown>,
    p_draft_notes: draftNotes || null,
    p_expected_version: expectedVersion,
  });

  if (error) {
    if (error.message.includes("version mismatch")) {
      return {
        success: false,
        conflict: true,
        error: "Draft is out of date. Another version has been saved.",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath(`/events/${eventId}/judging`);
  revalidatePath(`/events/${eventId}/judge/workspace/${_submissionId}`);
  return { success: true };
}

export async function submitEvaluationAction(
  evaluationId: string,
  scores: EvaluationScores,
  participantFeedback: string | undefined,
  organizerNotes: string | undefined,
  totalScore: number,
  expectedVersion: number,
  eventId: string,
  submissionId: string,
) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_evaluation", {
    p_eval_id: evaluationId,
    p_scores_json: scores as unknown as Record<string, unknown>,
    p_participant_feedback: participantFeedback || null,
    p_organizer_notes: organizerNotes || null,
    p_total_score: totalScore,
    p_expected_version: expectedVersion,
  });

  if (error) {
    if (error.message.includes("version mismatch")) {
      return {
        success: false,
        conflict: true,
        error: "Draft is out of date. Another version has been saved.",
      };
    }
    return { success: false, error: error.message };
  }

  // Once submitted, navigate back or refresh UI
  revalidatePath(`/events/${eventId}/judge/workspace/${submissionId}`);
  return { success: true };
}

export async function declareConflictAction(
  evaluationId: string,
  organizerNotes: string | undefined,
  expectedVersion: number,
  eventId: string,
  submissionId: string,
) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("declare_evaluation_conflict", {
    p_eval_id: evaluationId,
    p_organizer_notes: organizerNotes || null,
    p_expected_version: expectedVersion,
  });

  if (error) {
    if (error.message.includes("version mismatch")) {
      return {
        success: false,
        conflict: true,
        error: "Draft is out of date. Another version has been saved.",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath(`/events/${eventId}/judge/workspace/${submissionId}`);
  return { success: true };
}

export async function assignJudgeAction(
  eventId: string,
  submissionId: string,
  judgeId: string
) {
  const supabase = await createClient();

  const { error } = await supabase.from("evaluations").insert({
    event_id: eventId,
    submission_id: submissionId,
    judge_id: judgeId,
    status: "Assigned",
    scores: {},
    total_score: 0,
    version: 1,
  });

  if (error) {
    if (error.code === '23505') { // unique violation
      return { success: false, error: "Judge is already assigned to this submission." };
    }
    return { success: false, error: error.message };
  }

  revalidatePath(`/events/${eventId}/judging`);
  return { success: true };
}

export async function fetchAssignmentDataAction(eventId: string) {
  const supabase = await createClient();

  const [judgesRes, submissionsRes] = await Promise.all([
    supabase
      .from("event_members")
      .select("user_id, users(display_name, email)")
      .eq("event_id", eventId)
      .eq("role", "Judge"),
    supabase
      .from("submissions")
      .select("id, title, teams(name)")
      .eq("event_id", eventId)
  ]);

  const judges = (judgesRes.data || []).map(j => ({
    id: j.user_id,
    name: (j.users as { display_name?: string; email?: string })?.display_name || (j.users as { display_name?: string; email?: string })?.email || "Unknown Judge"
  }));

  const submissions = (submissionsRes.data || []).map(s => ({
    id: s.id,
    title: s.title || (s.teams as { name?: string })?.name || "Untitled Submission"
  }));

  return { judges, submissions };
}
