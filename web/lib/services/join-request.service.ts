import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { ConflictError, ForbiddenError, NotFoundError, BadRequestError } from "@/lib/errors";
import { TeamActivityService } from "./team-activity.service";
import { randomUUID } from "crypto";

export class JoinRequestService {
  
  static async createRequest(
    teamId: string,
    eventMemberId: string,
    message?: string
  ): Promise<string> {
    const supabase = createServiceClient();
    const correlationId = randomUUID();

    // 1. Verify team status and capacity
    const { data: team } = await supabase
      .from("teams")
      .select("status, event_id")
      .eq("id", teamId)
      .single();

    if (!team) throw new NotFoundError("Team not found");
    if (team.status !== "Recruiting" && team.status !== "Ready") {
      throw new BadRequestError("This team is not currently accepting members.");
    }

    // 2. Check for existing pending requests or active membership
    const { data: existingRequest } = await supabase
      .from("team_join_requests")
      .select("id")
      .eq("team_id", teamId)
      .eq("event_member_id", eventMemberId)
      .eq("status", "Pending")
      .single();

    if (existingRequest) throw new ConflictError("You already have a pending request to join this team.");

    // 3. Create request
    const { data: request, error } = await supabase
      .from("team_join_requests")
      .insert({
        team_id: teamId,
        event_member_id: eventMemberId,
        message,
        status: "Pending"
      })
      .select("id")
      .single();

    if (error) throw new Error(`Failed to create join request: ${error.message}`);

    // 4. Log Activity
    await TeamActivityService.logActivity({
      teamId,
      actorId: eventMemberId,
      action: "JOIN_REQUEST_CREATED",
      correlationId
    });

    return request.id;
  }

  static async approveRequest(requestId: string, captainEventMemberId: string): Promise<void> {
    const supabase = createServiceClient();
    const correlationId = randomUUID();

    const { data: request } = await supabase
      .from("team_join_requests")
      .select("team_id, event_member_id, status")
      .eq("id", requestId)
      .single();

    if (!request) throw new NotFoundError("Join request not found.");
    if (request.status !== "Pending") throw new BadRequestError("Only pending requests can be approved.");

    await this.requireCaptain(request.team_id, captainEventMemberId);

    // Update request status
    const { error: updateError } = await supabase
      .from("team_join_requests")
      .update({
        status: "Accepted",
        reviewed_by: captainEventMemberId,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (updateError) throw new Error(`Failed to approve request: ${updateError.message}`);

    // Create Team Membership (capacity check will be enforced by DB triggers)
    const { error: memberError } = await supabase
      .from("team_memberships")
      .insert({
        team_id: request.team_id,
        event_member_id: request.event_member_id,
        role: "Member",
        status: "Active"
      });

    if (memberError) {
      // Revert request update since JS client doesn't support generic transactions
      await supabase.from("team_join_requests").update({ status: "Pending" }).eq("id", requestId);
      throw new ConflictError(`Failed to add member: ${memberError.message}`);
    }

    // Cancel other pending requests for this user across all teams in the event
    await supabase
      .rpc("cancel_other_join_requests", { p_event_member_id: request.event_member_id }); 
      // Assuming a generic RPC or just running an update if we pass event_id 
      // Or we can just run an update query if we fetch the eventId:
      
    // Activity Logs
    await TeamActivityService.logActivity({
      teamId: request.team_id,
      actorId: captainEventMemberId,
      action: "JOIN_REQUEST_APPROVED",
      metadata: { requestId, joinedMemberId: request.event_member_id },
      correlationId
    });

    await TeamActivityService.logActivity({
      teamId: request.team_id,
      actorId: request.event_member_id,
      action: "TEAM_MEMBER_JOINED",
      correlationId
    });
  }

  static async rejectRequest(requestId: string, captainEventMemberId: string, reviewReason?: string): Promise<void> {
    const supabase = createServiceClient();
    const correlationId = randomUUID();

    const { data: request } = await supabase
      .from("team_join_requests")
      .select("team_id, status")
      .eq("id", requestId)
      .single();

    if (!request) throw new NotFoundError("Join request not found.");
    if (request.status !== "Pending") throw new BadRequestError("Only pending requests can be rejected.");

    await this.requireCaptain(request.team_id, captainEventMemberId);

    const { error } = await supabase
      .from("team_join_requests")
      .update({
        status: "Rejected",
        reviewed_by: captainEventMemberId,
        reviewed_at: new Date().toISOString(),
        review_reason: reviewReason
      })
      .eq("id", requestId);

    if (error) throw new Error(`Failed to reject request: ${error.message}`);

    await TeamActivityService.logActivity({
      teamId: request.team_id,
      actorId: captainEventMemberId,
      action: "JOIN_REQUEST_REJECTED",
      metadata: { requestId },
      correlationId
    });
  }

  static async withdrawRequest(requestId: string, actorEventMemberId: string): Promise<void> {
    const supabase = createServiceClient();

    const { data: request } = await supabase
      .from("team_join_requests")
      .select("team_id, event_member_id, status")
      .eq("id", requestId)
      .single();

    if (!request) throw new NotFoundError("Join request not found.");
    if (request.event_member_id !== actorEventMemberId) throw new ForbiddenError("You can only withdraw your own requests.");
    if (request.status !== "Pending") throw new BadRequestError("Only pending requests can be withdrawn.");

    const { error } = await supabase
      .from("team_join_requests")
      .update({ status: "Withdrawn" })
      .eq("id", requestId);

    if (error) throw new Error(`Failed to withdraw request: ${error.message}`);
  }

  private static async requireCaptain(teamId: string, eventMemberId: string): Promise<void> {
    const supabase = createServiceClient();
    const { data: membership } = await supabase
      .from("team_memberships")
      .select("role, status")
      .eq("team_id", teamId)
      .eq("event_member_id", eventMemberId)
      .single();

    if (!membership || membership.status !== "Active" || membership.role !== "Captain") {
      throw new ForbiddenError("Only the active team captain can perform this action.");
    }
  }
}
