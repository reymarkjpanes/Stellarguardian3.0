import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export class TeamRepository {
  
  static async createTeamWithCaptain(
    eventId: string,
    name: string,
    captainId: string
  ): Promise<string> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase.rpc("create_team_with_captain", {
      p_event_id: eventId,
      p_name: name,
      p_captain_id: captainId
    });
    
    if (error) {
      if (error.message.includes("Maximum number of teams")) {
        throw new Error("TEAM_LIMIT_REACHED");
      }
      if (error.message.includes("already in a team")) {
        throw new Error("ALREADY_IN_TEAM");
      }
      throw error;
    }
    
    return data as string;
  }

  static async resolveJoinRequest(
    requestId: string,
    action: "accept" | "reject",
    userId: string
  ): Promise<string> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase.rpc("resolve_team_join_request", {
      p_request_id: requestId,
      p_action: action,
      p_user_id: userId
    });
    
    if (error) {
      if (error.message.includes("maximum capacity")) {
        throw new Error("TEAM_FULL");
      }
      throw error;
    }
    
    return data.user_id as string;
  }
}
