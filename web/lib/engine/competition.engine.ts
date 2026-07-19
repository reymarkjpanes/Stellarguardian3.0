/**
 * Competition Engine
 * 
 * Orchestrates cross-domain workflows for an Event. 
 * Delegates business rules to specialized domains (Teams, Submissions, Escrow)
 * and coordinates side effects (Domain Events).
 */
import "server-only";
import { TeamService } from "@/lib/services/team.service";
import { SubmissionService } from "@/lib/services/submission.service";
import { publishDomainEvent } from "@/lib/events/publisher";

export class CompetitionEngine {
  
  /**
   * Orchestrates the creation of a team by a participant.
   */
  static async createTeam(
    eventId: string,
    captainId: string,
    teamName: string
  ): Promise<string> {
    const teamId = await TeamService.createTeam(eventId, captainId, teamName);
    
    await publishDomainEvent({
      type: "TeamCreated",
      eventId,
      teamId,
      captainId,
      teamName,
    });
    
    return teamId;
  }

  /**
   * Orchestrates resolving a team join request.
   */
  static async resolveJoinRequest(
    eventId: string,
    teamId: string,
    requestId: string,
    action: "accept" | "reject",
    resolvedBy: string
  ): Promise<void> {
    const targetUserId = await TeamService.resolveJoinRequest(eventId, teamId, requestId, action, resolvedBy);
    
    await publishDomainEvent({
      type: "TeamJoinRequestResolved",
      eventId,
      teamId,
      userId: targetUserId,
      action,
      resolvedBy,
    });
  }

  /**
   * Orchestrates the submission of a project by a team/participant.
   */
  static async submitProject(
    eventId: string,
    submitterId: string,
    payload: { title: string; description: string; projectUrl?: string }
  ): Promise<{ submissionId: string }> {
    const result = await SubmissionService.submitProject(eventId, submitterId, payload);
    
    await publishDomainEvent({
      type: "SubmissionCreated",
      eventId,
      teamId: result.teamId,
      submitterId,
      submissionId: result.submissionId,
      version: result.version,
    });

    return { submissionId: result.submissionId };
  }
}
