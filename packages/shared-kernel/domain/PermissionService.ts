import { PermissionType } from "../constants/permissions";
import { PermissionContext, PermissionMatrix } from "./PermissionMatrix";
import { TeamStatus } from "../constants/statuses";
import { Roles } from "../constants/roles";

export class PermissionService {
  public can(permission: PermissionType, context: PermissionContext): boolean {
    // 1. Role-based check
    let allowedByRole = false;
    
    if (context.role && PermissionMatrix[context.role]?.includes(permission)) {
      allowedByRole = true;
    }
    
    // Check if they are a captain (elevated role within a team context)
    if (context.isCaptain && PermissionMatrix[Roles.CAPTAIN]?.includes(permission)) {
      allowedByRole = true;
    }

    if (!allowedByRole) {
      return false;
    }

    // 2. State-based constraints (Preconditions)
    // For example, if a team is Locked or Archived, no modifications are allowed
    if (context.teamStatus) {
      const isModification = [
        "EditTeam", "ArchiveTeam", "LockTeam", "UnlockTeam",
        "InviteMember", "RemoveMember", "TransferCaptain",
        "ApproveJoinRequest", "RejectJoinRequest", "SubmitWork"
      ].includes(permission);

      if (isModification) {
        if (context.teamStatus === TeamStatus.LOCKED || context.teamStatus === TeamStatus.ARCHIVED) {
          // Only organizers/admins can modify locked/archived teams
          if (context.role !== Roles.ADMIN && context.role !== Roles.ORGANIZER) {
            return false;
          }
        }
      }
    }

    return true;
  }
}

export const permissionService = new PermissionService();
