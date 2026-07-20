import { EvaluationAggregate } from '../../judging/domain/EvaluationAggregate';

export interface ScoringStrategy {
  name: string;
  version: string;
  
  /**
   * Calculates the final aggregated score for a single submission 
   * given a set of evaluations.
   */
  calculateScore(evaluations: EvaluationAggregate[]): number;
}
