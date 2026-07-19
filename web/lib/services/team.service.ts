import "server-only";
import { TeamRepository } from "@/lib/repositories/team.repository";
import { ConflictError, ForbiddenError } from "@/lib/errors";

export class TeamService {
  
  static async createTeam(
    eventId: string,
    captainId: string,
    teamName: string
  ): Promise<string> {
    try {
      // The repository delegates to a Postgres RPC which acts as the atomic boundary.
      // We rely on the RPC to strictly enforce the following rules atomically:
      // 1. Event state is TeamFormation
      // 2. User is an accepted Participant
      // 3. User is not already in a team
      // 4. Max teams limit is not exceeded
      return await TeamRepository.createTeamWithCaptain(eventId, teamName, captainId);
    } catch (error: any) {
      if (error.message === "ALREADY_IN_TEAM") {
        throw new ConflictError("You are already in a team for this event.");
      }
      if (error.message === "TEAM_LIMIT_REACHED") {
        throw new ConflictError("The maximum number of teams for this event has been reached.");
      }
      if (error.message?.includes("not in TeamFormation phase")) {
        throw new ConflictError("Team formation is currently closed for this event.");
      }
      if (error.message?.includes("accepted participants")) {
        throw new ForbiddenError("Only accepted participants can create a team.");
      }
      throw error;
    }
  }

  static async resolveJoinRequest(
    eventId: string,
    teamId: string,
    requestId: string,
    action: "accept" | "reject",
    resolvedBy: string
  ): Promise<string> {
    try {
      return await TeamRepository.resolveJoinRequest(requestId, action, resolvedBy);
    } catch (error: any) {
      if (error.message === "TEAM_FULL") {
        throw new ConflictError("The team is already at its maximum capacity.");
      }
      if (error.message?.includes("Only the team captain")) {
        throw new ForbiddenError("Only the team captain can manage join requests.");
      }
      throw error;
    }
  }
}
