"use client";

/**
 * Event detail client component with tabs (Overview, Teams, Submissions, Judging, Settings).
 *
 * SECURITY: All mutations route through API endpoints.
 * - State changes → PATCH /api/events/[id]/state (validates via canTransition + permission matrix)
 * - Member applications → POST /api/events/[id]/register (validates event state + audit trail)
 * No direct browser-client Supabase writes.
 */
import { useState } from "react";

interface EventDetailClientProps {
  event: Record<string, unknown>;
  members: Array<{ user_id: string; role: string; status: string }>;
  teams: Array<{ id: string; name: string; captain_id: string; team_members: Array<{ user_id: string; joined_at: string }> }>;
  isOrganizer: boolean;
  myMembership: { user_id: string; role: string; status: string } | null;
  userId: string | null;
}

const TABS = ["overview", "teams", "submissions", "judging"] as const;
const ORGANIZER_TABS = ["overview", "members", "teams", "submissions", "judging", "settings"] as const;

export function EventDetailClient({ event, members, teams, isOrganizer, myMembership, userId }: EventDetailClientProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const tabs = isOrganizer ? ORGANIZER_TABS : TABS;

  /**
   * Apply to participate — routes through POST /api/events/[id]/register.
   * This ensures: event state validation, duplicate check, audit trail, notifications.
   */
  async function handleApply() {
    if (!userId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "Participant" }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        setActionError(error?.message ?? "Failed to apply.");
        return;
      }
      window.location.reload();
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  /**
   * State transition — routes through PATCH /api/events/[id]/state.
   * This ensures: canTransition() validation, precondition checks,
   * permission matrix enforcement, audit record, notifications.
   */
  async function handleStateChange(newState: string) {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_state: newState,
          version: event.version as number,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        setActionError(error?.message ?? "State transition failed.");
        return;
      }
      window.location.reload();
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-1">
            <a href="/dashboard" className="hover:text-[var(--text)]">Dashboard</a>
            <span>›</span>
            <span className="text-[var(--text)]">{event.title as string}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{event.title as string}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-default rounded-full px-3 py-1 text-xs font-medium">{event.state as string}</span>
          <span className="badge-default rounded-full px-3 py-1 text-xs font-medium">{event.category as string}</span>
        </div>
      </div>

      {/* Error display */}
      {actionError && (
        <div className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 flex items-center justify-between" role="alert">
          <p className="text-sm text-[var(--error)]">{actionError}</p>
          <button onClick={() => setActionError(null)} className="text-xs text-[var(--error)] hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap pb-3 px-1 border-b-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "border-neutral-900 text-[var(--text)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-lg border border-[var(--card-border)] p-5">
                <h2 className="font-medium mb-2">Description</h2>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{event.description as string}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InfoCard label="Format" value={event.format as string} />
                <InfoCard label="Network" value={event.network_mode as string} />
                <InfoCard label="Team Size" value={`${event.team_size_min}–${event.team_size_max}`} />
                <InfoCard label="Prize Pool" value={event.prize_pool_target ? `${event.prize_pool_target} XLM` : "Not set"} />
              </div>
            </div>
            <div className="space-y-4">
              {/* Sidebar - participant actions */}
              {!isOrganizer && (
                <div className="rounded-lg border border-[var(--card-border)] p-5 text-center">
                  <h3 className="font-medium mb-3">Participate</h3>
                  {!myMembership && event.state === "RegistrationOpen" && (
                    <button onClick={handleApply} disabled={actionLoading} className="w-full rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50">
                      {actionLoading ? "Applying…" : "Apply to Participate"}
                    </button>
                  )}
                  {myMembership && (
                    <div className="rounded-md bg-[var(--success-bg)] border border-[var(--success)] p-3">
                      <p className="text-sm font-medium text-[var(--success)]">{myMembership.role} — {myMembership.status}</p>
                    </div>
                  )}
                  {!myMembership && event.state !== "RegistrationOpen" && (
                    <p className="text-sm text-[var(--text-muted)]">Registration is not open.</p>
                  )}
                </div>
              )}
              <InfoCard label="Members" value={String(members.length)} />
              <InfoCard label="Teams" value={String(teams.length)} />
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <MembersTab
            members={members}
            isOrganizer={isOrganizer}
            eventId={event.id as string}
            onRefresh={() => window.location.reload()}
          />
        )}

        {activeTab === "teams" && (
          <div className="space-y-3">
            <h2 className="font-medium">Teams ({teams.length})</h2>
            {teams.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No teams formed yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {teams.map((team) => (
                  <div key={team.id} className="rounded-lg border border-[var(--card-border)] p-4">
                    <p className="font-medium">{team.name}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{team.team_members?.length ?? 0} members</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "submissions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">View and manage project submissions.</p>
              <a href={`/events/${event.id}/submissions`} className="text-sm font-medium text-[var(--accent)] hover:underline">
                Open Full View →
              </a>
            </div>
            <a
              href={`/events/${event.id}/submissions`}
              className="block card p-8 text-center hover:border-[var(--accent)] transition-colors"
            >
              <p className="text-sm text-[var(--text-muted)]">Click to manage submissions</p>
            </a>
          </div>
        )}

        {activeTab === "judging" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Judge scoring and evaluation results.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <a href={`/events/${event.id}/submissions`} className="card p-6 text-center hover:border-[var(--accent)] transition-colors">
                <p className="font-medium text-[var(--text)]">Submissions</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Review submitted projects</p>
              </a>
              <a href={`/events/${event.id}/winners`} className="card p-6 text-center hover:border-[var(--accent)] transition-colors">
                <p className="font-medium text-[var(--text)]">Winners</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">View prize allocation</p>
              </a>
              <a href={`/events/${event.id}/escrow`} className="card p-6 text-center hover:border-[var(--accent)] transition-colors">
                <p className="font-medium text-[var(--text)]">Escrow</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Funding & distribution</p>
              </a>
              <a href={`/events/${event.id}/disputes`} className="card p-6 text-center hover:border-[var(--accent)] transition-colors">
                <p className="font-medium text-[var(--text)]">Disputes</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Objections & resolution</p>
              </a>
            </div>
          </div>
        )}

        {activeTab === "settings" && isOrganizer && (
          <div className="space-y-6 max-w-xl">
            <div className="flex gap-3 mb-4">
              <a href={`/events/${event.id}/edit`} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors">
                Edit Event Details
              </a>
              <a href={`/events/${event.id}/teams`} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors">
                Manage Teams
              </a>
            </div>
            <div>
              <h2 className="font-medium mb-3">Lifecycle Controls</h2>
              <div className="grid grid-cols-2 gap-3">
                {event.state === "Draft" && (
                  <ActionButton label="Publish" onClick={() => handleStateChange("Published")} disabled={actionLoading} />
                )}
                {event.state === "Published" && (
                  <ActionButton label="Open Registration" onClick={() => handleStateChange("RegistrationOpen")} disabled={actionLoading} />
                )}
                {event.state === "RegistrationOpen" && (
                  <ActionButton label="Close Registration" onClick={() => handleStateChange("RegistrationClosed")} disabled={actionLoading} />
                )}
                {event.state === "RegistrationClosed" && (
                  <ActionButton label="Start Team Formation" onClick={() => handleStateChange("TeamFormation")} disabled={actionLoading} />
                )}
                {event.state === "TeamFormation" && (
                  <ActionButton label="Open Submissions" onClick={() => handleStateChange("SubmissionOpen")} disabled={actionLoading} />
                )}
                {event.state === "SubmissionOpen" && (
                  <ActionButton label="Close Submissions" onClick={() => handleStateChange("SubmissionClosed")} disabled={actionLoading} />
                )}
                {event.state === "SubmissionClosed" && (
                  <ActionButton label="Begin Judging" onClick={() => handleStateChange("Judging")} disabled={actionLoading} />
                )}
                {event.state === "Judging" && (
                  <ActionButton label="Open Review Window" onClick={() => handleStateChange("ReviewObjectionWindow")} disabled={actionLoading} />
                )}
                {event.state === "ReviewObjectionWindow" && (
                  <ActionButton label="Finalize Winners" onClick={() => handleStateChange("WinnersFinalized")} disabled={actionLoading} />
                )}
                {event.state === "WinnersFinalized" && (
                  <ActionButton label="Request Escrow Funding" onClick={() => handleStateChange("OrganizerFundsEscrow")} disabled={actionLoading} />
                )}
                {event.state === "OrganizerFundsEscrow" && (
                  <ActionButton label="Lock Escrow" onClick={() => handleStateChange("EscrowLocked")} disabled={actionLoading} />
                )}
                {event.state === "EscrowLocked" && (
                  <ActionButton label="Begin Distribution" onClick={() => handleStateChange("PrizeDistribution")} disabled={actionLoading} />
                )}
                {event.state === "PrizeDistribution" && (
                  <ActionButton label="Mark Completed" onClick={() => handleStateChange("Completed")} disabled={actionLoading} />
                )}
                {event.state === "Completed" && (
                  <ActionButton label="Archive" onClick={() => handleStateChange("Archived")} disabled={actionLoading} />
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--error)] bg-[var(--error-bg)] p-4">
              <h3 className="font-medium text-[var(--error)] mb-2">Danger Zone</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => { if (confirm("Cancel this event? This cannot be undone.")) handleStateChange("Cancelled"); }}
                  className="rounded-md border border-[var(--error)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-red-100"
                  disabled={actionLoading}
                >
                  Cancel Event
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
      <p className="mt-1 font-medium text-[var(--text)]">{value}</p>
    </div>
  );
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors"
    >
      {label}
    </button>
  );
}

/**
 * Members tab with approve/reject workflow for organizers.
 */
function MembersTab({
  members,
  isOrganizer,
  eventId,
  onRefresh,
}: {
  members: Array<{ user_id: string; role: string; status: string }>;
  isOrganizer: boolean;
  eventId: string;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleMemberAction(userId: string, action: "approve" | "reject") {
    setLoading(`${userId}-${action}`);
    try {
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action }),
      });
      if (res.ok) {
        onRefresh();
      }
    } finally {
      setLoading(null);
    }
  }

  const pendingMembers = members.filter((m) => m.status === "pending");
  const activeMembers = members.filter((m) => m.status !== "pending");

  return (
    <div className="space-y-6">
      {/* Pending approvals */}
      {isOrganizer && pendingMembers.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium text-amber-700 dark:text-amber-300">
            Pending Approvals ({pendingMembers.length})
          </h2>
          <div className="space-y-2">
            {pendingMembers.map((m) => (
              <div key={`${m.user_id}-${m.role}`} className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-[var(--text)]">{m.user_id.slice(0, 8)}…</span>
                  <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs">{m.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMemberAction(m.user_id, "approve")}
                    disabled={loading === `${m.user_id}-approve`}
                    className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {loading === `${m.user_id}-approve` ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() => handleMemberAction(m.user_id, "reject")}
                    disabled={loading === `${m.user_id}-reject`}
                    className="rounded-md border border-[var(--error)] px-3 py-1 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] disabled:opacity-50 transition-colors"
                  >
                    {loading === `${m.user_id}-reject` ? "…" : "Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active members */}
      <div className="space-y-3">
        <h2 className="font-medium">Members ({activeMembers.length})</h2>
        {activeMembers.length === 0 && pendingMembers.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {activeMembers.map((m) => (
              <div key={`${m.user_id}-${m.role}`} className="flex items-center justify-between rounded-lg border border-[var(--card-border)] p-3">
                <span className="text-sm font-mono">{m.user_id.slice(0, 8)}…</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs">{m.role}</span>
                  <span className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 text-xs">{m.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
