import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { ConflictError, ForbiddenError, NotFoundError, BadRequestError } from "@/lib/errors";
import { TeamActivityService } from "./team-activity.service";
import { randomUUID } from "crypto";

export class TeamService {
  
  /**
   * Creates a team and automatically assigns the creator as the Captain.
   */
  static async createTeam(
    eventId: string,
    creatorEventMemberId: string,
    payload: { name: string; slug: string; description?: string; tagline?: string }
  ): Promise<string> {
    const supabase = createServiceClient();
    const correlationId = randomUUID();

    // 1. Verify Event Formation State
    const { data: event } = await supabase
      .from("events")
      .select("state, max_teams")
      .eq("id", eventId)
      .single();

    if (!event) throw new NotFoundError("Event not found");
    if (!["RegistrationOpen", "RegistrationClosed"].includes(event.state)) {
      throw new BadRequestError("Teams can only be created during team formation phases.");
    }

    // 2. Enforce one-team-per-participant constraint (if not already handled by DB partial index)
    // Actually, udx_active_team_membership enforces this on the DB layer.

    // 3. Enforce Max Teams limit at event level
    if (event.max_teams) {
      const { count } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId);
      
      if ((count || 0) >= event.max_teams) {
        throw new ConflictError("The maximum number of teams for this event has been reached.");
      }
    }

    // 4. Create the Team (DB returns ID)
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        event_id: eventId,
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        tagline: payload.tagline,
        status: "Draft",
        visibility: "Private"
      })
      .select("id")
      .single();

    if (teamError) {
      if (teamError.code === "23505") throw new ConflictError("Team slug or name is already taken.");
      throw new Error(`Failed to create team: ${teamError.message}`);
    }

    // 5. Create Captain Membership
    const { error: memberError } = await supabase
      .from("team_memberships")
      .insert({
        team_id: team.id,
        event_member_id: creatorEventMemberId,
        role: "Captain",
        status: "Active"
      });

    if (memberError) {
      // Compensating transaction in absence of RPC
      await supabase.from("teams").delete().eq("id", team.id);
      throw new ConflictError(`Failed to join as captain: ${memberError.message}`);
    }

    // 6. Log Activity
    await TeamActivityService.logActivity({
      teamId: team.id,
      actorId: creatorEventMemberId,
      action: "TEAM_CREATED",
      metadata: { name: payload.name, slug: payload.slug },
      correlationId
    });

    return team.id;
  }

  static async updateTeam(
    teamId: string,
    payload: { name?: string; description?: string; status?: string; visibility?: string },
    actorEventMemberId: string
  ): Promise<void> {
    const supabase = createServiceClient();
    
    // Auth/Role handled via RLS or checking here:
    await this.requireCaptain(teamId, actorEventMemberId);

    const { error } = await supabase
      .from("teams")
      .update(payload)
      .eq("id", teamId);

    if (error) throw new Error(`Failed to update team: ${error.message}`);

    await TeamActivityService.logActivity({
      teamId,
      actorId: actorEventMemberId,
      action: "TEAM_UPDATED",
      metadata: payload
    });
  }

  static async archiveTeam(teamId: string, actorEventMemberId: string): Promise<void> {
    const supabase = createServiceClient();
    await this.requireCaptain(teamId, actorEventMemberId);

    const { error } = await supabase
      .from("teams")
      .update({ status: "Archived" }) // assuming soft-delete or archiving state
      .eq("id", teamId);

    if (error) throw new Error(`Failed to archive team: ${error.message}`);

    await TeamActivityService.logActivity({
      teamId,
      actorId: actorEventMemberId,
      action: "TEAM_ARCHIVED"
    });
  }

  static async lockTeam(teamId: string, actorEventMemberId: string): Promise<void> {
    const supabase = createServiceClient();
    await this.requireCaptain(teamId, actorEventMemberId);

    const { error } = await supabase.from("teams").update({ status: "Locked" }).eq("id", teamId);
    if (error) throw new Error(`Failed to lock team: ${error.message}`);

    await TeamActivityService.logActivity({ teamId, actorId: actorEventMemberId, action: "TEAM_LOCKED" });
  }

  static async unlockTeam(teamId: string, actorEventMemberId: string): Promise<void> {
    const supabase = createServiceClient();
    await this.requireCaptain(teamId, actorEventMemberId);

    const { error } = await supabase.from("teams").update({ status: "Ready" }).eq("id", teamId);
    if (error) throw new Error(`Failed to unlock team: ${error.message}`);

    await TeamActivityService.logActivity({ teamId, actorId: actorEventMemberId, action: "TEAM_UNLOCKED" });
  }

  static async transferCaptain(teamId: string, fromMemberId: string, toMemberId: string): Promise<void> {
    const supabase = createServiceClient();
    await this.requireCaptain(teamId, fromMemberId);
    const correlationId = randomUUID();

    // Ensure target is active member
    const { data: target } = await supabase
      .from("team_memberships")
      .select("id, status")
      .eq("team_id", teamId)
      .eq("event_member_id", toMemberId)
      .single();

    if (!target || target.status !== "Active") {
      throw new BadRequestError("Target user must be an active team member.");
    }

    // Demote current captain
    await supabase
      .from("team_memberships")
      .update({ role: "Member" })
      .eq("team_id", teamId)
      .eq("event_member_id", fromMemberId);

    // Promote new captain
    await supabase
      .from("team_memberships")
      .update({ role: "Captain" })
      .eq("team_id", teamId)
      .eq("event_member_id", toMemberId);

    await TeamActivityService.logActivity({
      teamId,
      actorId: fromMemberId,
      action: "CAPTAIN_TRANSFERRED",
      metadata: { toMemberId },
      correlationId
    });
  }

  static async removeMember(teamId: string, memberIdToRemove: string, actorEventMemberId: string): Promise<void> {
    const supabase = createServiceClient();
    const correlationId = randomUUID();

    // Verify actor is either the person leaving or the captain
    if (memberIdToRemove !== actorEventMemberId) {
      await this.requireCaptain(teamId, actorEventMemberId);
    }

    // If captain is leaving, require transfer first unless they are the last member
    if (memberIdToRemove === actorEventMemberId) {
      const { data: membership } = await supabase
        .from("team_memberships")
        .select("role")
        .eq("team_id", teamId)
        .eq("event_member_id", actorEventMemberId)
        .single();
      
      if (membership?.role === "Captain") {
        const { count } = await supabase
          .from("team_memberships")
          .select("id", { count: "exact", head: true })
          .eq("team_id", teamId)
          .eq("status", "Active");
          
        if ((count || 0) > 1) {
          throw new ConflictError("Captain must transfer role before leaving.");
        } else {
          // Last member, archive team
          await supabase.from("teams").update({ status: "Archived" }).eq("id", teamId);
        }
      }
    }

    const { error } = await supabase
      .from("team_memberships")
      .update({ status: memberIdToRemove === actorEventMemberId ? "Left" : "Removed", left_at: new Date().toISOString() })
      .eq("team_id", teamId)
      .eq("event_member_id", memberIdToRemove);

    if (error) throw new Error(`Failed to remove member: ${error.message}`);

    await TeamActivityService.logActivity({
      teamId,
      actorId: actorEventMemberId,
      action: "TEAM_MEMBER_LEFT",
      metadata: { removedMemberId: memberIdToRemove },
      correlationId
    });
  }

  static async getTeam(teamId: string) {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("teams")
      .select("*, team_memberships(*), team_metrics_view(*)")
      .eq("id", teamId)
      .single();
      
    if (error || !data) throw new NotFoundError("Team not found");
    return data;
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
