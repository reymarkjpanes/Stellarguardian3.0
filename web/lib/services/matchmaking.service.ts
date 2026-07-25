import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { NotFoundError } from "@/lib/errors";

export class MatchmakingService {
  /**
   * Recommends teams to a user based on their skills and preferred roles.
   * Full algorithmic ranking will be built in Sprint 3.5.
   */
  static async recommendTeams(
    _eventMemberId: string,
    _filters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    // Stub for future recommendation engine
    return [];
  }

  /**
   * Recommends available event members to a team based on team's preferred skills and open roles.
   * Full algorithmic ranking will be built in Sprint 3.5.
   */
  static async recommendMembers(
    _teamId: string,
    _filters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    // Stub for future recommendation engine
    return [];
  }

  /**
   * Calculates a 0-100 compatibility score between a user and a team.
   */
  static async calculateCompatibility(eventMemberId: string, teamId: string): Promise<number> {
    const supabase = createServiceClient();
    let score = 0;

    // Fetch team needs
    const { data: teamNeeds } = await supabase
      .from("team_preferred_skills")
      .select("skill_id")
      .eq("team_id", teamId);

    // Fetch user skills (Assuming user global profile stores skills)
    const { data: eventMember } = await supabase
      .from("event_members")
      .select("user_id")
      .eq("id", eventMemberId)
      .single();

    if (!eventMember || !teamNeeds) return 0;

    // Simplified scoring: If user has skills the team needs, increase score.
    // Full implementation deferred to Sprint 3.5.

    // In a real scenario, query user_skills where user_id = eventMember.user_id
    // and intersect with teamNeeds.

    // Stub logic
    score = 50;
    return score;
  }

  /**
   * Computes a profile completeness score (0-100%) for matchmaking readiness.
   */
  static async calculateCompleteness(eventMemberId: string): Promise<number> {
    const supabase = createServiceClient();

    const { data: member } = await supabase
      .from("event_members")
      .select("user_id")
      .eq("id", eventMemberId)
      .single();

    if (!member) throw new NotFoundError("Event member not found.");

    const { data: user } = await supabase
      .from("users")
      .select("avatar_url, bio, github_url, portfolio_url")
      .eq("id", member.user_id)
      .single();

    if (!user) return 0;

    let score = 0;
    const maxScore = 100;
    const items = [
      user.avatar_url,
      user.bio,
      user.github_url,
      user.portfolio_url,
      // we would also check wallets and skills
    ];

    const filledItems = items.filter((item) => item && item.trim().length > 0).length;
    score = Math.round((filledItems / items.length) * maxScore);

    return score;
  }

  /**
   * Analyzes current roster vs max_members to suggest roles.
   */
  static async findMissingRoles(teamId: string): Promise<string[]> {
    const supabase = createServiceClient();

    const { data: team } = await supabase
      .from("teams")
      .select("max_members, team_metrics_view(active_members)")
      .eq("id", teamId)
      .single();

    if (!team || !team.team_metrics_view) return [];

    const activeMembers = team.team_metrics_view[0]?.active_members || 0;
    const openSlots = (team.max_members || 5) - activeMembers;

    if (openSlots <= 0) return [];

    const { data: preferredRoles } = await supabase
      .from("team_preferred_roles")
      .select("role_name")
      .eq("team_id", teamId);

    // Filter down to the unfilled roles. For simplicity in 3.2, just return them.
    return preferredRoles?.map((r) => r.role_name) || [];
  }

  /**
   * Fast lookup of open teams by skills.
   */
  static async searchBySkills(
    eventId: string,
    skillIds: string[],
  ): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, status, team_preferred_skills!inner(skill_id)")
      .eq("event_id", eventId)
      .eq("status", "Recruiting")
      .in("team_preferred_skills.skill_id", skillIds);

    return (teams as Record<string, unknown>[] | null) ?? [];
  }
}
