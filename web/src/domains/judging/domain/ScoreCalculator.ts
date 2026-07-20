import { CriterionScore } from './EvaluationAggregate';

export interface ScoreValidationResult {
  isValid: boolean;
  errors: string[];
  totalScore: number;
}

export class ScoreCalculator {
  static calculateTotalScore(scores: CriterionScore[]): number {
    return scores.reduce((total, criteria) => {
      // Assuming score is already validated against maxScore, 
      // we scale it by weight if required, or if the score is absolute:
      // total = sum(score * weight) or something similar.
      // Based on typical implementations, if weight is a multiplier:
      return total + (criteria.score * criteria.weight);
    }, 0);
  }

  static validateScores(
    scores: CriterionScore[], 
    requiredCriteriaIds: string[]
  ): ScoreValidationResult {
    const errors: string[] = [];
    const providedIds = new Set(scores.map(s => s.criterionId));

    // 1. Missing Criteria
    for (const reqId of requiredCriteriaIds) {
      if (!providedIds.has(reqId)) {
        errors.push(`Missing score for criterion: ${reqId}`);
      }
    }

    // 2. Extra/Duplicate Criteria
    if (scores.length > requiredCriteriaIds.length) {
      errors.push('Extra or duplicate criteria found');
    }

    const idCount = new Map<string, number>();
    for (const score of scores) {
      // Duplicates
      idCount.set(score.criterionId, (idCount.get(score.criterionId) || 0) + 1);
      if (idCount.get(score.criterionId)! > 1) {
        errors.push(`Duplicate score for criterion: ${score.criterionId}`);
      }

      // 3. Invalid Score Bounds
      if (score.score < 0 || score.score > score.maxScore) {
        errors.push(`Score ${score.score} for criterion ${score.criterionId} is out of bounds (0-${score.maxScore})`);
      }

      // 4. Invalid Weight
      if (score.weight <= 0) {
        errors.push(`Invalid weight ${score.weight} for criterion ${score.criterionId}`);
      }
    }

    const isValid = errors.length === 0;
    return {
      isValid,
      errors,
      totalScore: isValid ? this.calculateTotalScore(scores) : 0
    };
  }
}
