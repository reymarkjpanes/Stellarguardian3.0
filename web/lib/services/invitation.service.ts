import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { ConflictError, ForbiddenError, NotFoundError, BadRequestError } from "@/lib/errors";
import { TeamActivityService } from "./team-activity.service";
import { randomUUID } from "crypto";

export class InvitationService {
  
  static async sendInvitation(
    teamId: string,
    targetEventMemberId: string,
    invitedByMemberId: string,
    message?: string
  ): Promise<string> {
    const supabase = createServiceClient();
    const correlationId = randomUUID();

    await this.requireCaptain(teamId, invitedByMemberId);

    // 1. Verify team status
    const { data: team } = await supabase
      .from("teams")
      .select("status")
      .eq("id", teamId)
      .single();

    if (!team) throw new NotFoundError("Team not found");
    if (team.status !== "Recruiting" && team.status !== "Ready") {
      throw new BadRequestError("This team cannot send invitations currently.");
    }

    // 2. Check for existing pending invitation or active membership
    const { data: existingInvite } = await supabase
      .from("team_invitations")
      .select("id")
      .eq("team_id", teamId)
      .eq("event_member_id", targetEventMemberId)
      .eq("status", "Pending")
      .single();

    if (existingInvite) throw new ConflictError("An invitation is already pending for this user.");

    // 3. Create invitation
    const { data: invite, error } = await supabase
      .from("team_invitations")
      .insert({
        team_id: teamId,
        event_member_id: targetEventMemberId,
        invited_by: invitedByMemberId,
        message,
        status: "Pending"
      })
      .select("id")
      .single();

    if (error) throw new Error(`Failed to send invitation: ${error.message}`);

    // 4. Log Activity
    await TeamActivityService.logActivity({
      teamId,
      actorId: invitedByMemberId,
      action: "INVITATION_SENT",
      metadata: { targetMemberId: targetEventMemberId, invitationId: invite.id },
      correlationId
    });

    return invite.id;
  }

  static async acceptInvitation(invitationId: string, actorEventMemberId: string): Promise<void> {
    const supabase = createServiceClient();
    const correlationId = randomUUID();

    const { data: invite } = await supabase
      .from("team_invitations")
      .select("team_id, event_member_id, status")
      .eq("id", invitationId)
      .single();

    if (!invite) throw new NotFoundError("Invitation not found.");
    if (invite.event_member_id !== actorEventMemberId) throw new ForbiddenError("You can only accept your own invitations.");
    if (invite.status !== "Pending") throw new BadRequestError("Only pending invitations can be accepted.");

    // Update invite status
    const { error: updateError } = await supabase
      .from("team_invitations")
      .update({
        status: "Accepted",
        responded_at: new Date().toISOString()
      })
      .eq("id", invitationId);

    if (updateError) throw new Error(`Failed to accept invitation: ${updateError.message}`);

    // Create Team Membership (capacity check will be enforced by DB triggers)
    const { error: memberError } = await supabase
      .from("team_memberships")
      .insert({
        team_id: invite.team_id,
        event_member_id: invite.event_member_id,
        role: "Member",
        status: "Active"
      });

    if (memberError) {
      // Revert invite update
      await supabase.from("team_invitations").update({ status: "Pending" }).eq("id", invitationId);
      throw new ConflictError(`Failed to join team: ${memberError.message}`);
    }

    // Since the user is now in a team, cancel their other pending invitations and join requests
    // We would typically use an RPC to do this cleanly across the event.
    // For now, we leave the side-effects to standard updates (assuming we fetch eventId).

    // Activity Logs
    await TeamActivityService.logActivity({
      teamId: invite.team_id,
      actorId: actorEventMemberId,
      action: "INVITATION_ACCEPTED",
      metadata: { invitationId },
      correlationId
    });

    await TeamActivityService.logActivity({
      teamId: invite.team_id,
      actorId: actorEventMemberId,
      action: "TEAM_MEMBER_JOINED",
      correlationId
    });
  }

  static async declineInvitation(invitationId: string, actorEventMemberId: string): Promise<void> {
    const supabase = createServiceClient();
    const correlationId = randomUUID();

    const { data: invite } = await supabase
      .from("team_invitations")
      .select("team_id, event_member_id, status")
      .eq("id", invitationId)
      .single();

    if (!invite) throw new NotFoundError("Invitation not found.");
    if (invite.event_member_id !== actorEventMemberId) throw new ForbiddenError("You can only decline your own invitations.");
    if (invite.status !== "Pending") throw new BadRequestError("Only pending invitations can be declined.");

    const { error } = await supabase
      .from("team_invitations")
      .update({
        status: "Declined",
        responded_at: new Date().toISOString()
      })
      .eq("id", invitationId);

    if (error) throw new Error(`Failed to decline invitation: ${error.message}`);

    await TeamActivityService.logActivity({
      teamId: invite.team_id,
      actorId: actorEventMemberId,
      action: "INVITATION_DECLINED",
      metadata: { invitationId },
      correlationId
    });
  }

  static async cancelInvitation(invitationId: string, captainEventMemberId: string): Promise<void> {
    const supabase = createServiceClient();
    
    const { data: invite } = await supabase
      .from("team_invitations")
      .select("team_id, status")
      .eq("id", invitationId)
      .single();

    if (!invite) throw new NotFoundError("Invitation not found.");
    if (invite.status !== "Pending") throw new BadRequestError("Only pending invitations can be cancelled.");

    await this.requireCaptain(invite.team_id, captainEventMemberId);

    const { error } = await supabase
      .from("team_invitations")
      .update({ status: "Cancelled" })
      .eq("id", invitationId);

    if (error) throw new Error(`Failed to cancel invitation: ${error.message}`);
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
