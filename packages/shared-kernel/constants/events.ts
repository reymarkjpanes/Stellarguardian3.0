export const DomainEvents = {
  // Teams
  TeamCreated: "TeamCreated",
  TeamUpdated: "TeamUpdated",
  TeamArchived: "TeamArchived",
  TeamLocked: "TeamLocked",
  TeamUnlocked: "TeamUnlocked",
  CaptainTransferred: "CaptainTransferred",
  
  // Join Requests
  JoinRequestCreated: "JoinRequestCreated",
  JoinRequestApproved: "JoinRequestApproved",
  JoinRequestRejected: "JoinRequestRejected",
  JoinRequestWithdrawn: "JoinRequestWithdrawn",

  // Invitations
  InvitationSent: "InvitationSent",
  InvitationAccepted: "InvitationAccepted",
  InvitationDeclined: "InvitationDeclined",
  InvitationCancelled: "InvitationCancelled"
} as const;

export type DomainEventType = typeof DomainEvents[keyof typeof DomainEvents];
