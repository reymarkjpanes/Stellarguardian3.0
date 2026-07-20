import { describe, it, expect } from 'vitest';
import { ScoreCalculator } from './ScoreCalculator';
import { CriterionScore } from './EvaluationAggregate';

describe('ScoreCalculator', () => {
  it('should calculate valid total scores', () => {
    const scores: CriterionScore[] = [
      { criterionId: '1', score: 8, maxScore: 10, weight: 1.5 },
      { criterionId: '2', score: 5, maxScore: 5, weight: 1.0 },
    ];
    
    // (8 * 1.5) + (5 * 1.0) = 12 + 5 = 17
    const result = ScoreCalculator.validateScores(scores, ['1', '2']);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.totalScore).toBe(17);
  });

  it('should flag missing criteria', () => {
    const scores: CriterionScore[] = [
      { criterionId: '1', score: 8, maxScore: 10, weight: 1.5 },
    ];
    
    const result = ScoreCalculator.validateScores(scores, ['1', '2']);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing score for criterion: 2');
  });

  it('should flag duplicate criteria', () => {
    const scores: CriterionScore[] = [
      { criterionId: '1', score: 8, maxScore: 10, weight: 1.5 },
      { criterionId: '1', score: 5, maxScore: 10, weight: 1.5 },
    ];
    
    const result = ScoreCalculator.validateScores(scores, ['1']);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Extra or duplicate criteria found');
    expect(result.errors).toContain('Duplicate score for criterion: 1');
  });

  it('should flag scores exceeding maxScore', () => {
    const scores: CriterionScore[] = [
      { criterionId: '1', score: 12, maxScore: 10, weight: 1.5 },
    ];
    
    const result = ScoreCalculator.validateScores(scores, ['1']);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Score 12 for criterion 1 is out of bounds (0-10)');
  });

  it('should flag invalid weights', () => {
    const scores: CriterionScore[] = [
      { criterionId: '1', score: 5, maxScore: 10, weight: 0 },
    ];
    
    const result = ScoreCalculator.validateScores(scores, ['1']);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid weight 0 for criterion 1');
  });
});
