import { ScoringStrategy } from './ScoringStrategy';
import { EvaluationAggregate } from '../../judging/domain/EvaluationAggregate';

export class WeightedAverageStrategy implements ScoringStrategy {
  readonly name = 'WeightedAverage';
  readonly version = 'v1';

  calculateScore(evaluations: EvaluationAggregate[]): number {
    if (!evaluations || evaluations.length === 0) return 0;

    let totalCumulativeScore = 0;
    
    for (const evaluation of evaluations) {
      // EvaluationAggregate inherently calculates its totalScore via its props or ScoreCalculator
      // We will sum the pre-calculated totalScore of each evaluation.
      // Alternatively, we could recalculate it from raw criteria here.
      // Assuming EvaluationAggregate's totalScore is already valid and correct.
      totalCumulativeScore += evaluation.props.totalScore;
    }

    // Average the total scores across all valid judges for this submission
    return totalCumulativeScore / evaluations.length;
  }
}
