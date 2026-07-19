/**
 * Event teams page — team formation, management, and viewing.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

interface Team {
  id: string;
  name: string;
  captain_id: string;
  members: { user_id: string; display_name: string }[];
}

export default function EventTeamsPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventState, setEventState] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function loadData() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get event state
    const { data: event } = await supabase
      .from("events")
      .select("state")
      .eq("id", eventId)
      .single();
    setEventState(event?.state ?? "");

    // Get user role
    const { data: membership } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();
    setUserRole(membership?.role ?? null);
    setUserId(user.id);

    // Get teams
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, captain_id")
      .eq("event_id", eventId);

    if (teamsData && teamsData.length > 0) {
      // Get team members
      const teamIds = teamsData.map((t) => t.id);
      const { data: membersData } = await supabase
        .from("team_members")
        .select("team_id, user_id")
        .in("team_id", teamIds);

      const userIds = [...new Set((membersData ?? []).map((m) => m.user_id))];
      const { data: users } = userIds.length > 0
        ? await supabase.from("users").select("id, display_name").in("id", userIds)
        : { data: [] };

      const usersMap = new Map((users ?? []).map((u) => [u.id, u]));

      const enrichedTeams = teamsData.map((t) => ({
        ...t,
        members: (membersData ?? [])
          .filter((m) => m.team_id === t.id)
          .map((m) => ({
            user_id: m.user_id,
            display_name: usersMap.get(m.user_id)?.display_name ?? "Unknown",
          })),
      }));

      setTeams(enrichedTeams);
    }

    setLoading(false);
  }

  async function handleCreateTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const res = await fetch(`/api/events/${eventId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: teamName }),
    });

    if (!res.ok) {
      const { error: apiError } = await res.json();
      setError(apiError?.message ?? "Failed to create team.");
      setCreating(false);
      return;
    }

    setTeamName("");
    setCreating(false);
    loadData();
  }

  async function handleJoinRequest(teamId: string) {
    setCreating(true);
    setError(null);

    const res = await fetch(`/api/events/${eventId}/teams/${teamId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });

    if (!res.ok) {
      const { error: apiError } = await res.json();
      setError(apiError?.message ?? "Failed to send join request.");
    } else {
      setError(null);
      // Show success feedback
      alert("Join request sent! The team captain will review it.");
    }
    setCreating(false);
  }

  const canCreateTeam = userRole === "Participant" && eventState === "TeamFormation";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-[var(--bg-muted)] rounded animate-pulse" />
        <div className="h-24 bg-[var(--bg-muted)] rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Teams</h2>
        <span className="text-xs text-[var(--text-muted)]">{teams.length} teams</span>
      </div>

      {/* Create team form */}
      {canCreateTeam && (
        <form onSubmit={handleCreateTeam} className="card p-4 flex gap-3">
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team name"
            required
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={creating}
            className="btn-primary px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Team"}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

      {/* Teams list */}
      {teams.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            {eventState === "TeamFormation"
              ? "No teams yet. Be the first to create one!"
              : "Teams will be formed during the TeamFormation phase."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <div key={team.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-[var(--text)]">{team.name}</h3>
                <span className="text-xs text-[var(--text-muted)]">
                  {team.members.length} member{team.members.length !== 1 && "s"}
                </span>
              </div>
              <div className="space-y-1">
                {team.members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-[10px] font-semibold">
                      {m.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {m.display_name}
                      {m.user_id === team.captain_id && (
                        <span className="ml-1 text-[var(--accent)]">★</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {/* Join button — only in TeamFormation for participants not already in a team */}
              {canCreateTeam && !team.members.some((m) => m.user_id === userId) && (
                <button
                  onClick={() => handleJoinRequest(team.id)}
                  disabled={creating}
                  className="mt-3 w-full rounded-md border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-muted)] transition-colors disabled:opacity-50"
                >
                  Request to Join
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
