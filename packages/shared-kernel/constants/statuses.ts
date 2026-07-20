export const TeamStatus = {
  DRAFT: "Draft",
  RECRUITING: "Recruiting",
  READY: "Ready",
  LOCKED: "Locked",
  ARCHIVED: "Archived"
} as const;

export type TeamStatusType = typeof TeamStatus[keyof typeof TeamStatus];

export const JoinRequestStatus = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn"
} as const;

export type JoinRequestStatusType = typeof JoinRequestStatus[keyof typeof JoinRequestStatus];
