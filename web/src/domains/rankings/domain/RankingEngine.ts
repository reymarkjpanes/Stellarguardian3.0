import { EvaluationAggregate } from '../../judging/domain/EvaluationAggregate';
import { ScoringStrategy } from './ScoringStrategy';
import { TieBreaker } from './TieBreaker';

export interface RankedSubmission {
  submissionId: string;
  totalScore: number;
  normalizedScore: number;
  judgeCount: number;
  ranking: number;
  tieBreakerReason?: string;
  strategy: string;
}

export class RankingEngine {
  constructor(private readonly strategy: ScoringStrategy) {}

  public calculateRankings(evaluations: EvaluationAggregate[]): RankedSubmission[] {
    // 1. Filter out non-submitted / non-finalized evaluations
    const validEvals = evaluations.filter(e => 
      e.status === 'Submitted' || e.status === 'Finalized'
    );

    // 2. Group by submission ID
    const grouped = new Map<string, EvaluationAggregate[]>();
    for (const e of validEvals) {
      const arr = grouped.get(e.props.submissionId) || [];
      arr.push(e);
      grouped.set(e.props.submissionId, arr);
    }

    // 3. Calculate scores for each submission
    const results: RankedSubmission[] = [];
    for (const [submissionId, evals] of grouped.entries()) {
      const totalScore = this.strategy.calculateScore(evals);
      
      results.push({
        submissionId,
        totalScore,
        normalizedScore: totalScore, // For WeightedAverage, total = normalized. Could differ in other strategies.
        judgeCount: evals.length,
        ranking: 0, // Assigned below
        strategy: `${this.strategy.name} ${this.strategy.version}`
      });
    }

    // 4. Sort and assign rankings
    results.sort((a, b) => {
      // Primary sort: totalScore
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      
      // Tie breaking
      const evalsA = grouped.get(a.submissionId)!;
      const evalsB = grouped.get(b.submissionId)!;
      const tieBreak = TieBreaker.compare(evalsA, evalsB);
      
      if (tieBreak > 0) {
        a.tieBreakerReason = 'Won tie-breaker (criteria weight/judge count)';
        return -1;
      } else if (tieBreak < 0) {
        b.tieBreakerReason = 'Won tie-breaker (criteria weight/judge count)';
        return 1;
      }
      
      a.tieBreakerReason = 'Unresolved tie (Organizer action required)';
      b.tieBreakerReason = 'Unresolved tie (Organizer action required)';
      return 0; // Remains a tie
    });

    // 5. Assign 1-based rankings (accounting for ties)
    let currentRank = 1;
    for (let i = 0; i < results.length; i++) {
      if (i > 0 && results[i]!.totalScore === results[i-1]!.totalScore && results[i]!.tieBreakerReason === 'Unresolved tie (Organizer action required)') {
        // Keep same rank as previous if it's an unresolved tie
        results[i]!.ranking = results[i-1]!.ranking;
      } else {
        results[i]!.ranking = currentRank;
      }
      currentRank++;
    }

    return results;
  }
}
