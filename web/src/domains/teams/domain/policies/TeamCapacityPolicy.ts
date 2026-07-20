export class TeamCapacityPolicy {
  /**
   * Evaluates if a team can accept a new member or send an invite.
   */
  static canJoin(currentActiveMembers: number, maxMembers: number): boolean {
    return currentActiveMembers < maxMembers;
  }
}
