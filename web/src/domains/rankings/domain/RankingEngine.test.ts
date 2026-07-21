import { describe, it, expect } from 'vitest';
import { RankingEngine } from './RankingEngine';
import { WeightedAverageStrategy } from './WeightedAverageStrategy';
import { EvaluationAggregate, EvaluationProps } from '../../judging/domain/EvaluationAggregate';

const createMockEval = (submissionId: string, status: any, totalScore: number, maxWeight: number = 1): EvaluationAggregate => {
  const props: EvaluationProps = {
    id: `eval-${Math.random()}`,
    submissionId,
    judgeId: `judge-${Math.random()}`,
    eventId: 'event-1',
    status,
    scores: {
      criteria: [
        { criterionId: 'c1', score: totalScore, maxScore: 10, weight: maxWeight }
      ]
    },
    conflictOfInterest: false,
    totalScore,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  return new EvaluationAggregate(props);
};

describe('RankingEngine', () => {
  const strategy = new WeightedAverageStrategy();
  const engine = new RankingEngine(strategy);

  it('should exclude Draft and Flagged evaluations', () => {
    const evals = [
      createMockEval('sub-1', 'Submitted', 10),
      createMockEval('sub-1', 'Draft', 5),
      createMockEval('sub-2', 'Flagged', 8),
      createMockEval('sub-2', 'Finalized', 9),
    ];

    const results = engine.calculateRankings(evals);
    expect(results).toHaveLength(2);
    
    const sub1 = results.find(r => r.submissionId === 'sub-1');
    expect(sub1?.judgeCount).toBe(1);
    expect(sub1?.totalScore).toBe(10); // Draft is ignored
    
    const sub2 = results.find(r => r.submissionId === 'sub-2');
    expect(sub2?.judgeCount).toBe(1);
    expect(sub2?.totalScore).toBe(9); // Flagged is ignored
  });

  it('should rank highest scores first', () => {
    const evals = [
      createMockEval('sub-1', 'Submitted', 10),
      createMockEval('sub-2', 'Submitted', 15),
      createMockEval('sub-3', 'Submitted', 12),
    ];

    const results = engine.calculateRankings(evals);
    expect(results[0]!.submissionId).toBe('sub-2'); // 15
    expect(results[0]!.ranking).toBe(1);
    
    expect(results[1]!.submissionId).toBe('sub-3'); // 12
    expect(results[1]!.ranking).toBe(2);
    
    expect(results[2]!.submissionId).toBe('sub-1'); // 10
    expect(results[2]!.ranking).toBe(3);
  });

  it('should break ties using TieBreaker (highest weight wins)', () => {
    const evals = [
      // Both sub-1 and sub-2 have an average of 10.
      createMockEval('sub-1', 'Submitted', 10, 1),
      createMockEval('sub-2', 'Submitted', 10, 2), // Higher weight in its criteria
    ];

    const results = engine.calculateRankings(evals);
    expect(results[0]!.submissionId).toBe('sub-2'); 
    expect(results[0]!.ranking).toBe(1);
    expect(results[0]!.tieBreakerReason).toContain('Won tie-breaker');
    
    expect(results[1]!.submissionId).toBe('sub-1');
    expect(results[1]!.ranking).toBe(2);
  });

  it('should leave unresolved ties with same ranking', () => {
    const evals = [
      createMockEval('sub-1', 'Submitted', 10, 1),
      createMockEval('sub-2', 'Submitted', 10, 1),
    ];

    const results = engine.calculateRankings(evals);
    expect(results[0]!.ranking).toBe(1);
    expect(results[1]!.ranking).toBe(1); // Unresolved tie
    expect(results[0]!.tieBreakerReason).toContain('Unresolved tie');
    expect(results[1]!.tieBreakerReason).toContain('Unresolved tie');
  });
});
