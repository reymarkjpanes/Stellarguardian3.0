import { StateMachine, Transition } from "@packages/shared-kernel/domain/StateMachine";
import { SubmissionState, SubmissionStates } from "@packages/shared-kernel/constants/SubmissionStates";

export interface SubmissionContext {
  submissionId: string;
  isCaptain: boolean;
  validationPassed: boolean;
  hasMissedDeadline: boolean;
}

export function createSubmissionStateMachine(initialState: SubmissionState = SubmissionStates.NOT_STARTED) {
  const transitions: Transition<SubmissionState, SubmissionContext>[] = [
    // Starting out
    {
      from: SubmissionStates.NOT_STARTED,
      to: SubmissionStates.DRAFT,
      guards: [(ctx) => ctx.isCaptain, (ctx) => !ctx.hasMissedDeadline]
    },
    // Drafting
    {
      from: SubmissionStates.DRAFT,
      to: SubmissionStates.READY,
      guards: [(ctx) => ctx.validationPassed, (ctx) => !ctx.hasMissedDeadline]
    },
    // Can always go back to draft from ready
    {
      from: SubmissionStates.READY,
      to: SubmissionStates.DRAFT,
      guards: [(ctx) => !ctx.hasMissedDeadline]
    },
    // Submitting
    {
      from: SubmissionStates.READY,
      to: SubmissionStates.SUBMITTED,
      guards: [(ctx) => ctx.isCaptain, (ctx) => ctx.validationPassed, (ctx) => !ctx.hasMissedDeadline]
    },
    // Submitting directly from DRAFT (if valid)
    {
      from: SubmissionStates.DRAFT,
      to: SubmissionStates.SUBMITTED,
      guards: [(ctx) => ctx.isCaptain, (ctx) => ctx.validationPassed, (ctx) => !ctx.hasMissedDeadline]
    },
    // Locking (Organizer or automatic at deadline)
    {
      from: SubmissionStates.SUBMITTED,
      to: SubmissionStates.LOCKED,
    },
    // If they missed deadline while in DRAFT/READY, it gets locked
    {
      from: SubmissionStates.DRAFT,
      to: SubmissionStates.LOCKED,
      guards: [(ctx) => ctx.hasMissedDeadline]
    },
    {
      from: SubmissionStates.READY,
      to: SubmissionStates.LOCKED,
      guards: [(ctx) => ctx.hasMissedDeadline]
    },
    // Judging Module transitions (Future)
    {
      from: SubmissionStates.LOCKED,
      to: SubmissionStates.UNDER_REVIEW
    },
    {
      from: SubmissionStates.UNDER_REVIEW,
      to: SubmissionStates.REVIEWED
    },
    {
      from: SubmissionStates.REVIEWED,
      to: SubmissionStates.FINALIZED
    }
  ];

  return new StateMachine<SubmissionState, SubmissionContext>(initialState, transitions);
}
