import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JudgingService } from '../../../../src/domains/judging/services/JudgingService';
import { EvaluationRepository } from '../../../../src/domains/judging/repositories/EvaluationRepository';
import { EvaluationAggregate, EvaluationProps } from '../../../../src/domains/judging/domain/EvaluationAggregate';

const createMockEvaluation = (id: string, status: 'Assigned' | 'Draft' = 'Assigned'): EvaluationAggregate => {
  const props: EvaluationProps = {
    id,
    submissionId: 'sub-1',
    judgeId: 'judge-1',
    eventId: 'event-1',
    status,
    scores: { criteria: [] },
    conflictOfInterest: false,
    totalScore: 0,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  return new EvaluationAggregate(props);
};

describe('JudgingService', () => {
  let repo: EvaluationRepository;
  let service: JudgingService;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      findByJudgeAndSubmission: vi.fn(),
      saveDraft: vi.fn(),
      submit: vi.fn(),
      declareConflict: vi.fn(),
    } as unknown as EvaluationRepository;
    
    service = new JudgingService(repo);
  });

  describe('saveDraft', () => {
    it('should transition to Draft and save', async () => {
      const evalMock = createMockEvaluation('eval-1', 'Assigned');
      vi.mocked(repo.findById).mockResolvedValue(evalMock);

      await service.saveDraft('eval-1', { criteria: [] }, 'My draft note');

      expect(evalMock.status).toBe('Draft');
      expect(evalMock.props.draftNotes).toBe('My draft note');
      expect(repo.saveDraft).toHaveBeenCalledWith(evalMock);
    });
  });

  describe('submitEvaluation', () => {
    it('should submit successfully when valid', async () => {
      const evalMock = createMockEvaluation('eval-1', 'Draft');
      vi.mocked(repo.findById).mockResolvedValue(evalMock);

      const validScores = {
        criteria: [
          { criterionId: 'crit-1', score: 10, maxScore: 10, weight: 1 }
        ]
      };

      await service.submitEvaluation(
        'eval-1', 
        validScores, 
        ['crit-1'],
        'Great job!',
        'No issues'
      );

      expect(evalMock.status).toBe('Submitted');
      expect(evalMock.props.participantFeedback).toBe('Great job!');
      expect(evalMock.props.organizerNotes).toBe('No issues');
      expect(repo.submit).toHaveBeenCalledWith(evalMock);
    });

    it('should throw if validation fails', async () => {
      const evalMock = createMockEvaluation('eval-1', 'Draft');
      vi.mocked(repo.findById).mockResolvedValue(evalMock);

      const invalidScores = {
        criteria: [
          { criterionId: 'crit-1', score: 15, maxScore: 10, weight: 1 } // Out of bounds
        ]
      };

      await expect(
        service.submitEvaluation('eval-1', invalidScores, ['crit-1'])
      ).rejects.toThrow(/out of bounds/);

      expect(repo.submit).not.toHaveBeenCalled();
    });
  });

  describe('declareConflictOfInterest', () => {
    it('should flag the evaluation', async () => {
      const evalMock = createMockEvaluation('eval-1', 'Assigned');
      vi.mocked(repo.findById).mockResolvedValue(evalMock);

      await service.declareConflictOfInterest('eval-1', 'My cousin is on this team');

      expect(evalMock.status).toBe('Flagged');
      expect(evalMock.props.conflictOfInterest).toBe(true);
      expect(evalMock.props.organizerNotes).toBe('My cousin is on this team');
      expect(repo.declareConflict).toHaveBeenCalledWith(evalMock);
    });
  });
});
