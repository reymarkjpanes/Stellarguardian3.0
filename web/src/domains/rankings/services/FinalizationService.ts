import { createServerClient as createClient } from '@/lib/supabase/server';
import { RankingEngine, RankedSubmission } from '../domain/RankingEngine';
import { WeightedAverageStrategy } from '../domain/WeightedAverageStrategy';
import { EvaluationAggregate, EvaluationProps } from '../../judging/domain/EvaluationAggregate';

export class FinalizationService {
  /**
   * Calculates the rankings and commits the finalization transaction via RPC.
   */
  static async finalizeEvent(eventId: string, expectedVersion: number): Promise<RankedSubmission[]> {
    const supabase = await createClient();

    // 1. Fetch all Submitted evaluations for the event
    // In a real system, you might fetch raw evaluations and map them to EvaluationAggregate
    const { data: rawEvals, error: evalError } = await supabase
      .from('evaluations')
      .select('*, submissions!inner(id, event_id)')
      .eq('submissions.event_id', eventId)
      .eq('status', 'Submitted');

    if (evalError) {
      throw new Error(`Failed to fetch evaluations: ${evalError.message}`);
    }

    // Map to Domain Aggregates
    const evaluations = rawEvals.map(row => {
      const props: EvaluationProps = {
        id: row.id,
        submissionId: row.submission_id,
        judgeId: row.judge_id,
        eventId: eventId,
        status: row.status as any,
        scores: row.scores as any,
        conflictOfInterest: row.conflict_of_interest,
        totalScore: row.total_score || 0, // Using total_score column if it exists, else recalculate
        version: row.version,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
      // If total_score doesn't exist on the table directly, we extract from scores JSON.
      // E.g., `props.totalScore = Object.values(props.scores.criteria).reduce((sum, c) => sum + (c.score * c.weight), 0)`
      if (row.total_score === undefined && props.scores?.criteria) {
        props.totalScore = props.scores.criteria.reduce((sum: number, c: any) => sum + (c.score * c.weight), 0);
      }
      return new EvaluationAggregate(props);
    });

    // 2. Calculate Rankings
    const strategy = new WeightedAverageStrategy(); // Default
    const engine = new RankingEngine(strategy);
    const rankings = engine.calculateRankings(evaluations);

    // 3. Persist the Finalization Transaction
    // Convert RankedSubmission to format expected by RPC (camelCase will be accessed as r->>'submissionId')
    const { error: rpcError } = await supabase.rpc('finalize_event_judging', {
      p_event_id: eventId,
      p_expected_version: expectedVersion,
      p_rankings_json: rankings
    });

    if (rpcError) {
      // Could be version mismatch or other constraint
      throw new Error(`Finalization transaction failed: ${rpcError.message}`);
    }

    return rankings;
  }
}
