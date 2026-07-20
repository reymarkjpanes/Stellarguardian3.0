export class CaptainPolicy {
  /**
   * Evaluates whether a captain can transfer their role to another member.
   * Pure function, no side effects.
   */
  static canTransfer(currentCaptainId: string, actorId: string, targetMemberStatus: string): boolean {
    if (currentCaptainId !== actorId) return false;
    if (targetMemberStatus !== "Active") return false;
    return true;
  }

  /**
   * Evaluates whether a captain can leave the team.
   */
  static canLeave(isCaptain: boolean, activeMemberCount: number): boolean {
    if (!isCaptain) return true; // non-captains can always leave
    // If they are the captain, they can only leave if they are the last member
    return activeMemberCount <= 1;
  }

  static canRemove(isCaptain: boolean): boolean {
    return isCaptain;
  }
}
