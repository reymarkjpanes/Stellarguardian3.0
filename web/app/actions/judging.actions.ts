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

    // Fallback for unmigrated remote database
    if (error.message.includes("Could not find the function")) {
      const { error: fallbackError } = await supabase
        .from("evaluations")
        .update({ scores: scores as unknown as Record<string, unknown> })
        .eq("id", evaluationId);

      if (fallbackError) return { success: false, error: fallbackError.message };
    } else {
      return { success: false, error: error.message };
    }
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

    // Fallback for unmigrated remote database
    if (error.message.includes("Could not find the function")) {
      const { error: fallbackError } = await supabase
        .from("evaluations")
        .update({ scores: scores as unknown as Record<string, unknown> })
        .eq("id", evaluationId);

      if (fallbackError) return { success: false, error: fallbackError.message };
    } else {
      return { success: false, error: error.message };
    }
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

    // Fallback for unmigrated remote database
    if (error.message.includes("Could not find the function")) {
      const { error: fallbackError } = await supabase
        .from("evaluations")
        .update({ conflict_of_interest: true })
        .eq("id", evaluationId);

      if (fallbackError) return { success: false, error: fallbackError.message };
    } else {
      return { success: false, error: error.message };
    }
  }

  revalidatePath(`/events/${eventId}/judge/workspace/${submissionId}`);
  return { success: true };
}

export async function assignJudgeAction(eventId: string, submissionId: string, judgeId: string) {
  const supabase = await createClient();

  // Use a minimal payload to bypass schema cache issues on newer columns
  const { error } = await supabase.from("evaluations").insert({
    submission_id: submissionId,
    judge_id: judgeId,
    scores: {},
  });

  if (error) {
    if (error.code === "23505" || error.message.includes("already assigned")) {
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
      .in("role", ["Judge", "Organizer"]),
    supabase.from("submissions").select("id, title, teams(name)").eq("event_id", eventId),
  ]);

  const uniqueJudges = new Map();
  for (const j of judgesRes.data || []) {
    if (!uniqueJudges.has(j.user_id)) {
      uniqueJudges.set(j.user_id, {
        id: j.user_id,
        name:
          (j.users as { display_name?: string; email?: string })?.display_name ||
          (j.users as { display_name?: string; email?: string })?.email ||
          "Unknown Judge",
      });
    }
  }
  const judges = Array.from(uniqueJudges.values());

  const submissions = (submissionsRes.data || []).map((s) => ({
    id: s.id,
    title: s.title || (s.teams as { name?: string })?.name || "Untitled Submission",
  }));

  return { judges, submissions };
}

export async function unassignJudgeAction(evaluationId: string, eventId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("evaluations").delete().eq("id", evaluationId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/events/${eventId}/judging`);
  return { success: true };
}
