"use client";

/**
 * Teams client component — handles create team form and join request interactions only.
 * All data is passed as props from the Server Component parent; no Supabase calls here.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Team {
  id: string;
  name: string;
  captain_id: string;
  members: { user_id: string; display_name: string }[];
}

interface TeamsClientProps {
  eventId: string;
  eventState: string;
  teams: Team[];
  userId: string | null;
  userRole: string | null;
}

export function TeamsClient({
  eventId,
  eventState,
  teams: initialTeams,
  userId,
  userRole,
}: TeamsClientProps) {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const canCreateTeam = userRole === "Participant" && eventState === "TeamFormationLocked";

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
    // Refresh server data — re-fetches the page RSC
    router.refresh();
  }

  async function handleJoinRequest(teamId: string) {
    setJoiningId(teamId);
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
      // Optimistic feedback
      alert("Join request sent! The team captain will review it.");
    }
    setJoiningId(null);
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
            {eventState === "TeamFormationLocked"
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
                  disabled={joiningId === team.id}
                  className="mt-3 w-full rounded-md border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-muted)] transition-colors disabled:opacity-50"
                >
                  {joiningId === team.id ? "Sending..." : "Request to Join"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
