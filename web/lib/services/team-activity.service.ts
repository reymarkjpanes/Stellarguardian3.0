import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { randomUUID } from "crypto";

export type TeamActivityAction =
  | "TEAM_CREATED"
  | "TEAM_UPDATED"
  | "TEAM_ARCHIVED"
  | "TEAM_LOCKED"
  | "TEAM_UNLOCKED"
  | "TEAM_MEMBER_JOINED"
  | "TEAM_MEMBER_LEFT"
  | "CAPTAIN_TRANSFERRED"
  | "JOIN_REQUEST_CREATED"
  | "JOIN_REQUEST_APPROVED"
  | "JOIN_REQUEST_REJECTED"
  | "INVITATION_SENT"
  | "INVITATION_ACCEPTED"
  | "INVITATION_DECLINED"
  | "FILE_UPLOADED"
  | "FILE_READY"
  | "FILE_DELETED"
  | "SETTINGS_UPDATED";

interface LogTeamActivityParams {
  teamId: string;
  actorId: string;
  action: TeamActivityAction;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  requestId?: string;
}

export class TeamActivityService {
  static async logActivity(params: LogTeamActivityParams): Promise<void> {
    try {
      const supabase = createServiceClient();
      
      await supabase.from("team_activity").insert({
        team_id: params.teamId,
        actor_id: params.actorId,
        action: params.action,
        metadata: params.metadata ?? {},
        correlation_id: params.correlationId ?? randomUUID(),
        request_id: params.requestId,
        source: "API", // Can be extended to system/cron etc.
      });
    } catch (err) {
      console.error("[TeamActivity] Failed to log activity:", err);
      // Non-blocking
    }
  }
}
