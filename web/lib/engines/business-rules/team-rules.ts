/**
 * Pure functions defining team business invariants.
 * While actual enforcement is atomic via Postgres RPCs, these rules 
 * can be used for pre-flight validation and property-based testing.
 */

export interface TeamState {
  id: string;
  captainId: string;
  memberIds: string[];
}

export interface EventConstraints {
  maxTeams?: number;
  maxTeamSize?: number;
  minTeamSize?: number;
}

export interface GlobalTeamState {
  events: Record<string, EventConstraints>;
  teams: Record<string, TeamState>;
  userTeams: Record<string, Record<string, string>>; // eventId -> userId -> teamId
}

export const TeamRules = {
  canCreateTeam(
    state: GlobalTeamState,
    eventId: string,
    captainId: string
  ): { ok: boolean; error?: string } {
    const event = state.events[eventId];
    if (!event) return { ok: false, error: "Event not found" };

    const eventTeams = Object.values(state.teams).filter(t => 
      Object.entries(state.userTeams[eventId] || {}).some(([userId, teamId]) => teamId === t.id)
    );
    
    // In our simplified mock state, let's just count how many teams belong to this event
    // Actually, state.userTeams maps eventId -> userId -> teamId. 
    // The number of unique teams in this event:
    const uniqueTeamIds = new Set(Object.values(state.userTeams[eventId] || {}));
    
    if (event.maxTeams && uniqueTeamIds.size >= event.maxTeams) {
      return { ok: false, error: "TEAM_LIMIT_REACHED" };
    }

    if (state.userTeams[eventId]?.[captainId]) {
      return { ok: false, error: "ALREADY_IN_TEAM" };
    }

    return { ok: true };
  },

  canApproveJoinRequest(
    state: GlobalTeamState,
    eventId: string,
    teamId: string,
    userId: string,
    approverId: string
  ): { ok: boolean; error?: string } {
    const team = state.teams[teamId];
    if (!team) return { ok: false, error: "Team not found" };

    if (team.captainId !== approverId) {
      return { ok: false, error: "Only the team captain can manage join requests" };
    }

    const event = state.events[eventId];
    if (!event) return { ok: false, error: "Event not found" };

    if (event.maxTeamSize && team.memberIds.length >= event.maxTeamSize) {
      return { ok: false, error: "TEAM_FULL" };
    }

    if (state.userTeams[eventId]?.[userId]) {
      if (state.userTeams[eventId][userId] === teamId) {
        return { ok: false, error: "ALREADY_IN_TEAM" };
      }
      return { ok: false, error: "ALREADY_IN_ANOTHER_TEAM" };
    }

    return { ok: true };
  }
};
