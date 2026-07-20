import { TeamStatus } from "@packages/shared-kernel/constants/statuses";

export class TeamStatePolicy {
  /**
   * Prevents modifications to locked or archived teams.
   */
  static canEdit(status: string): boolean {
    return status !== TeamStatus.LOCKED && status !== TeamStatus.ARCHIVED;
  }
}
