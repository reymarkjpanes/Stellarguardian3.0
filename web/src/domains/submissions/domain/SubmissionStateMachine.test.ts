import { describe, it, expect } from 'vitest';
import { createSubmissionStateMachine, SubmissionContext } from './SubmissionStateMachine';
import { SubmissionStates } from '@packages/shared-kernel/constants/SubmissionStates';

describe('SubmissionStateMachine', () => {
  const defaultContext: SubmissionContext = {
    submissionId: 'test-id',
    isCaptain: true,
    validationPassed: true,
    hasMissedDeadline: false
  };

  describe('Valid Transitions', () => {
    it('allows Captain to transition from NOT_STARTED to DRAFT before deadline', async () => {
      const sm = createSubmissionStateMachine(SubmissionStates.NOT_STARTED);
      const success = await sm.transition(SubmissionStates.DRAFT, defaultContext);
      
      expect(success).toBe(true);
      expect(sm.state).toBe(SubmissionStates.DRAFT);
    });

    it('allows transition from DRAFT to READY when validation passes', async () => {
      const sm = createSubmissionStateMachine(SubmissionStates.DRAFT);
      const success = await sm.transition(SubmissionStates.READY, defaultContext);
      
      expect(success).toBe(true);
      expect(sm.state).toBe(SubmissionStates.READY);
    });

    it('allows direct transition from DRAFT to SUBMITTED when valid and captain', async () => {
      const sm = createSubmissionStateMachine(SubmissionStates.DRAFT);
      const success = await sm.transition(SubmissionStates.SUBMITTED, defaultContext);
      
      expect(success).toBe(true);
      expect(sm.state).toBe(SubmissionStates.SUBMITTED);
    });

    it('allows transition to LOCKED from SUBMITTED', async () => {
      const sm = createSubmissionStateMachine(SubmissionStates.SUBMITTED);
      const success = await sm.transition(SubmissionStates.LOCKED, defaultContext);
      
      expect(success).toBe(true);
      expect(sm.state).toBe(SubmissionStates.LOCKED);
    });

    it('allows transition to LOCKED from DRAFT if deadline is missed', async () => {
      const sm = createSubmissionStateMachine(SubmissionStates.DRAFT);
      const success = await sm.transition(SubmissionStates.LOCKED, {
        ...defaultContext,
        hasMissedDeadline: true
      });
      
      expect(success).toBe(true);
      expect(sm.state).toBe(SubmissionStates.LOCKED);
    });
  });

  describe('Invalid Transitions', () => {
    it('prevents non-captain from starting a DRAFT', async () => {
      const sm = createSubmissionStateMachine(SubmissionStates.NOT_STARTED);
      const success = await sm.transition(SubmissionStates.DRAFT, {
        ...defaultContext,
        isCaptain: false
      });
      
      expect(success).toBe(false);
      expect(sm.state).toBe(SubmissionStates.NOT_STARTED);
    });

    it('prevents transitioning to READY if validation fails', async () => {
      const sm = createSubmissionStateMachine(SubmissionStates.DRAFT);
      const success = await sm.transition(SubmissionStates.READY, {
        ...defaultContext,
        validationPassed: false
      });
      
      expect(success).toBe(false);
      expect(sm.state).toBe(SubmissionStates.DRAFT);
    });

    it('prevents transitioning from LOCKED back to DRAFT', async () => {
      const sm = createSubmissionStateMachine(SubmissionStates.LOCKED);
      const success = await sm.transition(SubmissionStates.DRAFT, defaultContext);
      
      expect(success).toBe(false);
      expect(sm.state).toBe(SubmissionStates.LOCKED);
    });

    it('prevents submitting after deadline', async () => {
      const sm = createSubmissionStateMachine(SubmissionStates.DRAFT);
      const success = await sm.transition(SubmissionStates.SUBMITTED, {
        ...defaultContext,
        hasMissedDeadline: true
      });
      
      expect(success).toBe(false);
      expect(sm.state).toBe(SubmissionStates.DRAFT); // Did not submit
    });
  });
});
