import { EvaluationAggregate } from '../../judging/domain/EvaluationAggregate';

export class TieBreaker {
  /**
   * Compares two sets of evaluations for two submissions to break a tie.
   * Returns a positive number if a > b (a wins).
   * Returns a negative number if a < b (b wins).
   * Returns 0 if it remains a tie (requires Organizer resolution).
   */
  static compare(evalsA: EvaluationAggregate[], evalsB: EvaluationAggregate[]): number {
    // 1. Highest score in highest-weight criterion
    const bestCriterionA = this.getHighestScoreInHighestWeightCriterion(evalsA);
    const bestCriterionB = this.getHighestScoreInHighestWeightCriterion(evalsB);

    if (bestCriterionA > bestCriterionB) return 1;
    if (bestCriterionA < bestCriterionB) return -1;

    // 2. More completed evaluations
    if (evalsA.length > evalsB.length) return 1;
    if (evalsA.length < evalsB.length) return -1;

    // 3. Fallback - Tie remains for Organizer Resolution
    return 0;
  }

  private static getHighestScoreInHighestWeightCriterion(evaluations: EvaluationAggregate[]): number {
    if (evaluations.length === 0) return 0;
    
    // Find the max weight across all criteria in these evaluations
    let maxWeight = 0;
    for (const evalAggr of evaluations) {
      for (const crit of evalAggr.scores.criteria) {
        if (crit.weight > maxWeight) {
          maxWeight = crit.weight;
        }
      }
    }

    // Now find the average score for criteria with that max weight
    let totalScoreInMaxWeight = 0;
    let countInMaxWeight = 0;

    for (const evalAggr of evaluations) {
      for (const crit of evalAggr.scores.criteria) {
        if (crit.weight === maxWeight) {
          totalScoreInMaxWeight += (crit.score * crit.weight);
          countInMaxWeight++;
        }
      }
    }

    if (countInMaxWeight === 0) return 0;
    return totalScoreInMaxWeight / countInMaxWeight;
  }
}
