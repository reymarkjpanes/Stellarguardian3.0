import { randomUUID } from 'crypto';

export type EvaluationLifecycleState =
  | 'Assigned'
  | 'Draft'
  | 'Submitted'
  | 'Flagged'
  | 'Finalized';

export type EvaluationEvent =
  | { type: 'EVALUATION_ASSIGNED' }
  | { type: 'EVALUATION_DRAFT_SAVED' }
  | { type: 'EVALUATION_SUBMITTED' }
  | { type: 'CONFLICT_DECLARED' }
  | { type: 'EVALUATION_FLAGGED' }
  | { type: 'EVALUATION_FINALIZED' };

export class EvaluationStateMachine {
  constructor(public currentState: EvaluationLifecycleState = 'Assigned') {}

  transition(event: EvaluationEvent): EvaluationLifecycleState {
    let nextState = this.currentState;
    
    switch (this.currentState) {
      case 'Assigned':
        if (event.type === 'EVALUATION_DRAFT_SAVED') nextState = 'Draft';
        if (event.type === 'CONFLICT_DECLARED') nextState = 'Flagged';
        break;

      case 'Draft':
        if (event.type === 'EVALUATION_DRAFT_SAVED') nextState = 'Draft';
        if (event.type === 'EVALUATION_SUBMITTED') nextState = 'Submitted';
        if (event.type === 'CONFLICT_DECLARED') nextState = 'Flagged';
        break;

      case 'Submitted':
        if (event.type === 'EVALUATION_DRAFT_SAVED') nextState = 'Submitted'; // Editing after submission (if allowed)
        if (event.type === 'EVALUATION_SUBMITTED') nextState = 'Submitted';
        if (event.type === 'EVALUATION_FLAGGED') nextState = 'Flagged';
        if (event.type === 'EVALUATION_FINALIZED') nextState = 'Finalized';
        break;

      case 'Flagged':
        // Once flagged for conflict/review, usually organizers must resolve it.
        // It could go back to Assigned or Finalized depending on Organizer action,
        // but for Judges, it is effectively locked.
        if (event.type === 'EVALUATION_FINALIZED') nextState = 'Finalized';
        break;

      case 'Finalized':
        // Terminal state
        break;
    }

    if (nextState !== this.currentState) {
      this.currentState = nextState;
      return nextState;
    } else if (event.type === 'EVALUATION_DRAFT_SAVED' || event.type === 'EVALUATION_SUBMITTED') {
       return nextState; // allow self-transitions explicitly defined
    }

    throw new Error(
      `Invalid transition from ${this.currentState} using event ${event.type}`
    );
  }
}
