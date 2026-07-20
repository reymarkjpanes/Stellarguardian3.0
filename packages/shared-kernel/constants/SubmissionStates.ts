export const SubmissionStates = {
  NOT_STARTED: "NOT_STARTED",
  DRAFT: "DRAFT",
  READY: "READY",
  SUBMITTED: "SUBMITTED",
  LOCKED: "LOCKED",
  UNDER_REVIEW: "UNDER_REVIEW",
  REVIEWED: "REVIEWED",
  FINALIZED: "FINALIZED",
  ARCHIVED: "ARCHIVED"
} as const;

export type SubmissionState = typeof SubmissionStates[keyof typeof SubmissionStates];
