import { EvaluationRepository } from "../repositories/EvaluationRepository";
import { EvaluationScores } from "../domain/EvaluationAggregate";
import { ScoreCalculator } from "../domain/ScoreCalculator";

export class JudgingService {
  constructor(private readonly evaluationRepo: EvaluationRepository) {}

  async saveDraft(
    evaluationId: string,
    scores: EvaluationScores,
    draftNotes?: string,
  ): Promise<void> {
    const aggregate = await this.evaluationRepo.findById(evaluationId);
    if (!aggregate) throw new Error("Evaluation not found");

    aggregate.saveDraft(scores, draftNotes);

    await this.evaluationRepo.saveDraft(aggregate);
  }

  async submitEvaluation(
    evaluationId: string,
    scores: EvaluationScores,
    requiredCriteriaIds: string[],
    participantFeedback?: string,
    organizerNotes?: string,
  ): Promise<void> {
    const aggregate = await this.evaluationRepo.findById(evaluationId);
    if (!aggregate) throw new Error("Evaluation not found");

    const validationResult = ScoreCalculator.validateScores(scores.criteria, requiredCriteriaIds);
    if (!validationResult.isValid) {
      throw new Error(`Invalid scores: ${validationResult.errors.join(", ")}`);
    }

    aggregate.submit(scores, participantFeedback, organizerNotes, validationResult.totalScore);

    await this.evaluationRepo.submit(aggregate);
  }

  async declareConflictOfInterest(evaluationId: string, reason?: string): Promise<void> {
    const aggregate = await this.evaluationRepo.findById(evaluationId);
    if (!aggregate) throw new Error("Evaluation not found");

    aggregate.declareConflictOfInterest(reason);

    await this.evaluationRepo.declareConflict(aggregate);
  }
}
