export const Permission = {
  // Workspace Level
  ManageWorkspace: "ManageWorkspace",
  CreateEvent: "CreateEvent",
  // Event Level
  ManageEvent: "ManageEvent",
  // Team Level
  CreateTeam: "CreateTeam",
  EditTeam: "EditTeam",
  ArchiveTeam: "ArchiveTeam",
  LockTeam: "LockTeam",
  UnlockTeam: "UnlockTeam",
  // Member Level
  InviteMember: "InviteMember",
  RemoveMember: "RemoveMember",
  TransferCaptain: "TransferCaptain",
  ApproveJoinRequest: "ApproveJoinRequest",
  RejectJoinRequest: "RejectJoinRequest",
  // Submissions
  ManageSubmission: "ManageSubmission",
  SubmitWork: "SubmitWork",
  // Judging
  ReviewSubmission: "ReviewSubmission",
  AssignJudges: "AssignJudges"
} as const;

export type PermissionType = typeof Permission[keyof typeof Permission];
