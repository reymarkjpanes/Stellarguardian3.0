import { describe, it, expect } from 'vitest';
import { EvaluationStateMachine } from './EvaluationStateMachine';

describe('EvaluationStateMachine', () => {
  it('should transition from Assigned to Draft when draft is saved', () => {
    const sm = new EvaluationStateMachine('Assigned');
    expect(sm.transition({ type: 'EVALUATION_DRAFT_SAVED' })).toBe('Draft');
  });

  it('should transition from Draft to Submitted when submitted', () => {
    const sm = new EvaluationStateMachine('Draft');
    expect(sm.transition({ type: 'EVALUATION_SUBMITTED' })).toBe('Submitted');
  });

  it('should transition from Assigned to Flagged when conflict declared', () => {
    const sm = new EvaluationStateMachine('Assigned');
    expect(sm.transition({ type: 'CONFLICT_DECLARED' })).toBe('Flagged');
  });

  it('should throw error for invalid transition', () => {
    const sm = new EvaluationStateMachine('Finalized');
    expect(() => sm.transition({ type: 'EVALUATION_SUBMITTED' })).toThrow();
  });

  it('should stay in Draft when saving draft from Draft state', () => {
    const sm = new EvaluationStateMachine('Draft');
    expect(sm.transition({ type: 'EVALUATION_DRAFT_SAVED' })).toBe('Draft');
  });
});
