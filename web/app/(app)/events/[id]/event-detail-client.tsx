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
import { EventLifecycleStepper } from "@/components/events/event-lifecycle-stepper";
import type { EventState } from "@/components/events/event-lifecycle-stepper";
import { EventTrustSignals } from "@/components/events/event-trust-signals";
import { EventActionCenter } from "@/components/events/overview/event-action-center";

interface EventDetailClientProps {
  event: Record<string, unknown>;
  members: Array<{ user_id: string; role: string; status: string }>;
  teams: Array<{ id: string; name: string; captain_id: string; team_members: Array<{ user_id: string; joined_at: string }> }>;
  isOrganizer: boolean;
  myMembership: { user_id: string; role: string; status: string } | null;
  userId: string | null;
  // Enrichment data for new components
  judgeCount: number;
  hasVerifiedOrganizer: boolean;
  reviewWindowHours: number;
}

const TABS = ["overview", "teams", "submissions", "judging"] as const;
const ORGANIZER_TABS = ["overview", "members", "teams", "submissions", "judging", "settings"] as const;

export function EventDetailClient({ event, members, teams, isOrganizer, myMembership, userId, judgeCount, hasVerifiedOrganizer, reviewWindowHours }: EventDetailClientProps) {
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

  // Derived Action Center Props
  const roleName = isOrganizer ? "Organizer" : myMembership ? myMembership.role : "Guest";
  
  const milestones = [
    { id: "registered", label: "Registered for Event", completed: !!myMembership },
    { id: "team", label: "Joined a Team", completed: teams.some(t => t.team_members?.some(m => m.user_id === userId)) },
    { id: "wallet", label: "Wallet Connected", completed: true }, // mocked
    { id: "repo", label: "Repository Added", completed: false }, // mocked
    { id: "demo", label: "Demo Uploaded", completed: false }, // mocked
    { id: "submitted", label: "Final Submitted", completed: false }, // mocked
  ];

  const quickActions = isOrganizer 
    ? [
        { id: "settings", label: "Event Settings", href: `/events/${event.id}/settings` },
        { id: "members", label: "Manage Members", href: `/events/${event.id}/members` },
        { id: "subs", label: "Review Submissions", href: `/events/${event.id}/submissions` },
      ]
    : myMembership 
      ? [
          { id: "team", label: "My Team", href: `/events/${event.id}/teams` },
          { id: "sub", label: "Continue Submission", href: `/events/${event.id}/submissions`, primary: true },
        ]
      : [
          { id: "apply", label: "Apply to Participate", onClick: handleApply, primary: true },
        ];

  const roleStats = isOrganizer 
    ? [
        { label: "Participants", value: members.length },
        { label: "Teams Formed", value: teams.length },
      ]
    : [
        { label: "Team Status", value: teams.some(t => t.team_members?.some(m => m.user_id === userId)) ? "Joined" : "No Team" },
        { label: "Submission", value: "Not Started" },
      ];

  const recentActivities = [
    ...teams.map(t => ({ id: `team-${t.id}`, timeAgo: "Recently", description: `Team ${t.name} was created.` })),
    ...members.slice(0, 3).map(m => ({ id: `mem-${m.user_id}`, timeAgo: "Recently", description: `A new ${m.role.toLowerCase()} joined the event.` })),
  ].slice(0, 5);

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
          <EventActionCenter
            eventName={event.title as string}
            currentPhase={event.state as string}
            countdownText="Deadline to be announced"
            heroPrimaryActionLabel={!myMembership ? "Apply to Participate" : "Continue Workspace"}
            onHeroPrimaryAction={!myMembership ? handleApply : () => setActiveTab("teams")}
            role={roleName}
            milestones={milestones}
            quickActions={quickActions}
            roleStats={roleStats}
            announcements={[]} // Mocked for now
            activities={recentActivities}
          />
        )}

        {activeTab === "members" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">View the community directory and manage members.</p>
              <a href={`/events/${event.id}/members`} className="text-sm font-medium text-[var(--accent)] hover:underline">
                Open Full View →
              </a>
            </div>
            <a
              href={`/events/${event.id}/members`}
              className="block card p-8 text-center hover:border-[var(--accent)] transition-colors"
            >
              <p className="text-sm text-[var(--text-muted)]">Click to manage members</p>
            </a>
          </div>
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


