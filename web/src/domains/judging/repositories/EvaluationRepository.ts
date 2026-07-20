import { EvaluationAggregate, EvaluationProps } from '../domain/EvaluationAggregate';
import { SupabaseClient } from '@supabase/supabase-js';

export class EvaluationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(evaluationId: string): Promise<EvaluationAggregate | null> {
    const { data, error } = await this.supabase
      .from('evaluations')
      .select('*')
      .eq('id', evaluationId)
      .single();

    if (error || !data) return null;

    return this.mapToAggregate(data);
  }

  async findByJudgeAndSubmission(judgeId: string, submissionId: string): Promise<EvaluationAggregate | null> {
    const { data, error } = await this.supabase
      .from('evaluations')
      .select('*')
      .eq('judge_id', judgeId)
      .eq('submission_id', submissionId)
      .single();

    if (error || !data) return null;

    return this.mapToAggregate(data);
  }

  // Uses RPCs for CQRS commands rather than raw upserts to enforce state transitions at DB level
  async saveDraft(aggregate: EvaluationAggregate): Promise<void> {
    const { error } = await this.supabase.rpc('save_draft_evaluation', {
      p_eval_id: aggregate.id,
      p_scores_json: aggregate.scores,
      p_draft_notes: aggregate.props.draftNotes,
      p_expected_version: aggregate.props.version
    });

    if (error) throw new Error(`Failed to save draft evaluation: ${error.message}`);
  }

  async submit(aggregate: EvaluationAggregate): Promise<void> {
    const { error } = await this.supabase.rpc('submit_evaluation', {
      p_eval_id: aggregate.id,
      p_scores_json: aggregate.scores,
      p_participant_feedback: aggregate.props.participantFeedback,
      p_organizer_notes: aggregate.props.organizerNotes,
      p_total_score: aggregate.props.totalScore,
      p_expected_version: aggregate.props.version
    });

    if (error) throw new Error(`Failed to submit evaluation: ${error.message}`);
  }

  async declareConflict(aggregate: EvaluationAggregate): Promise<void> {
    const { error } = await this.supabase.rpc('declare_evaluation_conflict', {
      p_eval_id: aggregate.id,
      p_organizer_notes: aggregate.props.organizerNotes,
      p_expected_version: aggregate.props.version
    });

    if (error) throw new Error(`Failed to declare conflict: ${error.message}`);
  }

  private mapToAggregate(row: any): EvaluationAggregate {
    const props: EvaluationProps = {
      id: row.id,
      submissionId: row.submission_id,
      judgeId: row.judge_id,
      eventId: row.event_id, // we might need to join to get event_id if not directly on evaluations
      status: row.status,
      scores: row.scores || { criteria: [] },
      conflictOfInterest: row.conflict_of_interest,
      participantFeedback: row.participant_feedback,
      organizerNotes: row.organizer_notes,
      draftNotes: row.draft_notes,
      totalScore: row.total_score || 0,
      rubricVersion: row.rubric_version,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
    return new EvaluationAggregate(props);
  }
}
