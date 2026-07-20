import { PermissionType, Permission } from "../constants/permissions";
import { Role, Roles } from "../constants/roles";
import { TeamStatusType, TeamStatus } from "../constants/statuses";

export interface PermissionContext {
  role?: Role;
  teamStatus?: TeamStatusType;
  isCaptain?: boolean;
}

export const PermissionMatrix: Record<Role, PermissionType[]> = {
  [Roles.ADMIN]: Object.values(Permission),
  [Roles.ORGANIZER]: [
    Permission.ManageWorkspace,
    Permission.CreateEvent,
    Permission.ManageEvent,
    Permission.CreateTeam,
    Permission.EditTeam,
    Permission.ArchiveTeam,
    Permission.LockTeam,
    Permission.UnlockTeam,
    Permission.InviteMember,
    Permission.RemoveMember,
    Permission.TransferCaptain,
    Permission.ApproveJoinRequest,
    Permission.RejectJoinRequest,
    Permission.ManageSubmission,
    Permission.SubmitWork,
    Permission.ReviewSubmission,
    Permission.AssignJudges
  ],
  [Roles.CO_ORGANIZER]: [
    Permission.ManageEvent,
    Permission.CreateTeam,
    Permission.EditTeam,
    Permission.ArchiveTeam,
    Permission.LockTeam,
    Permission.UnlockTeam,
    Permission.InviteMember,
    Permission.RemoveMember,
    Permission.TransferCaptain,
    Permission.ApproveJoinRequest,
    Permission.RejectJoinRequest,
    Permission.ManageSubmission,
    Permission.SubmitWork,
    Permission.ReviewSubmission,
    Permission.AssignJudges
  ],
  [Roles.JUDGE_LEAD]: [
    Permission.ReviewSubmission,
    Permission.AssignJudges
  ],
  [Roles.JUDGE]: [
    Permission.ReviewSubmission
  ],
  [Roles.MENTOR]: [],
  [Roles.PARTICIPANT]: [
    Permission.CreateTeam
  ],
  [Roles.CAPTAIN]: [
    Permission.EditTeam,
    Permission.ArchiveTeam,
    Permission.LockTeam,
    Permission.UnlockTeam,
    Permission.InviteMember,
    Permission.RemoveMember,
    Permission.TransferCaptain,
    Permission.ApproveJoinRequest,
    Permission.RejectJoinRequest,
    Permission.SubmitWork
  ],
  [Roles.MEMBER]: [],
  [Roles.SPONSOR]: [],
  [Roles.VOLUNTEER]: []
};
