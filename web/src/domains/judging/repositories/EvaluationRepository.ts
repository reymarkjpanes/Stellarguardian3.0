import { EvaluationAggregate, EvaluationProps } from "../domain/EvaluationAggregate";
import { SupabaseClient } from "@supabase/supabase-js";

export class EvaluationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(evaluationId: string): Promise<EvaluationAggregate | null> {
    const { data, error } = await this.supabase
      .from("evaluations")
      .select("*")
      .eq("id", evaluationId)
      .single();

    if (error || !data) return null;

    return this.mapToAggregate(data);
  }

  async findByJudgeAndSubmission(
    judgeId: string,
    submissionId: string,
  ): Promise<EvaluationAggregate | null> {
    const { data, error } = await this.supabase
      .from("evaluations")
      .select("*")
      .eq("judge_id", judgeId)
      .eq("submission_id", submissionId)
      .single();

    if (error || !data) return null;

    return this.mapToAggregate(data);
  }

  // Uses RPCs for CQRS commands rather than raw upserts to enforce state transitions at DB level
  async saveDraft(aggregate: EvaluationAggregate): Promise<void> {
    const { error } = await this.supabase.rpc("save_draft_evaluation", {
      p_eval_id: aggregate.id,
      p_scores_json: aggregate.scores,
      p_draft_notes: aggregate.props.draftNotes,
      p_expected_version: aggregate.props.version,
    });

    if (error) throw new Error(`Failed to save draft evaluation: ${error.message}`);
  }

  async submit(aggregate: EvaluationAggregate): Promise<void> {
    const { error } = await this.supabase.rpc("submit_evaluation", {
      p_eval_id: aggregate.id,
      p_scores_json: aggregate.scores,
      p_participant_feedback: aggregate.props.participantFeedback,
      p_organizer_notes: aggregate.props.organizerNotes,
      p_total_score: aggregate.props.totalScore,
      p_expected_version: aggregate.props.version,
    });

    if (error) throw new Error(`Failed to submit evaluation: ${error.message}`);
  }

  async declareConflict(aggregate: EvaluationAggregate): Promise<void> {
    const { error } = await this.supabase.rpc("declare_evaluation_conflict", {
      p_eval_id: aggregate.id,
      p_organizer_notes: aggregate.props.organizerNotes,
      p_expected_version: aggregate.props.version,
    });

    if (error) throw new Error(`Failed to declare conflict: ${error.message}`);
  }

  private mapToAggregate(row: Record<string, unknown>): EvaluationAggregate {
    const props: EvaluationProps = {
      id: row.id as string,
      submissionId: row.submission_id as string,
      judgeId: row.judge_id as string,
      eventId: row.event_id as string,
      status: row.status as EvaluationProps["status"],
      scores: (row.scores as EvaluationProps["scores"]) ?? { criteria: [] },
      conflictOfInterest: row.conflict_of_interest as boolean,
      participantFeedback: row.participant_feedback as string | undefined,
      organizerNotes: row.organizer_notes as string | undefined,
      draftNotes: row.draft_notes as string | undefined,
      totalScore: (row.total_score as number) || 0,
      rubricVersion: row.rubric_version as string | undefined,
      version: row.version as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
    return new EvaluationAggregate(props);
  }
}
