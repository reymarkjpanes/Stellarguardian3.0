"use client";

/**
 * Event detail — Overview tab content only.
 *
 * Navigation between Teams / Submissions / Judging / etc. is handled by
 * EventSubNav in layout.tsx, which links to dedicated sub-pages.
 * This component renders what lives at /events/[id] (the Overview route).
 *
 * SECURITY: All mutations route through API endpoints.
 * - State changes → PATCH /api/events/[id]/state
 * - Member applications → POST /api/events/[id]/register
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EventActionCenter } from "@/components/events/overview/event-action-center";

interface EventDetailClientProps {
  event: Record<string, unknown>;
  members: Array<{ user_id: string; role: string; status: string }>;
  teams: Array<{
    id: string;
    name: string;
    captain_id: string;
    team_members: Array<{ user_id: string; joined_at: string }>;
  }>;
  isOrganizer: boolean;
  myMembership: { user_id: string; role: string; status: string } | null;
  userId: string | null;
  judgeCount: number;
  hasVerifiedOrganizer: boolean;
  hasVerifiedWallet: boolean;
  submissionStatus: string | null;
  reviewWindowHours: number;
}

export function EventDetailClient({
  event,
  members,
  teams,
  isOrganizer,
  myMembership,
  userId,
  hasVerifiedWallet,
  submissionStatus,
}: EventDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loading = actionLoading || isPending;

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
        const body = await res.json();
        const err = body?.error;
        // Surface the specific unmet preconditions from the state machine when available
        const unmet: string[] = err?.details?.unmetPreconditions ?? [];
        if (unmet.length > 0) {
          setActionError("Cannot advance: " + unmet.join(" · "));
        } else {
          setActionError(err?.message ?? "State transition failed.");
        }
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  const roleName = isOrganizer ? "Organizer" : myMembership ? myMembership.role : "Guest";
  const isInTeam = teams.some((t) => t.team_members?.some((m) => m.user_id === userId));

  // Submission status flags — derived from server-fetched state
  const hasSubmission = !!submissionStatus;
  const isSubmitted =
    submissionStatus === "Submitted" ||
    submissionStatus === "SUBMITTED" ||
    submissionStatus === "LOCKED" ||
    submissionStatus === "Locked";

  const milestones = [
    { id: "registered", label: "Registered for Event", completed: !!myMembership },
    { id: "team", label: "Joined a Team", completed: isInTeam },
    { id: "wallet", label: "Wallet Connected", completed: hasVerifiedWallet },
    { id: "repo", label: "Repository Added", completed: hasSubmission },
    { id: "demo", label: "Demo Uploaded", completed: hasSubmission },
    { id: "submitted", label: "Final Submitted", completed: isSubmitted },
  ];

  const quickActions = isOrganizer
    ? [
        { id: "members", label: "Manage Members", href: `/events/${event.id}/members` },
        { id: "subs", label: "Review Submissions", href: `/events/${event.id}/submissions` },
        { id: "escrow", label: "Escrow & Prizes", href: `/events/${event.id}/escrow` },
      ]
    : myMembership
      ? [
          {
            id: "team",
            label: isInTeam ? "My Team" : "Find or Create a Team",
            href: `/events/${event.id}/teams`,
            primary: !isInTeam,
          },
          {
            id: "sub",
            label: isSubmitted
              ? "View Submission"
              : hasSubmission
                ? "Continue Submission"
                : "Start Submission",
            href: `/events/${event.id}/submissions`,
            primary: isInTeam && !isSubmitted,
          },
        ]
      : [
          {
            id: "apply",
            label: "Apply to Participate",
            href: `/events/${event.id}/register`,
            primary: true,
          },
        ];

  const roleStats = isOrganizer
    ? [
        { label: "Participants", value: members.filter((m) => m.role === "Participant").length },
        { label: "Teams Formed", value: teams.length },
      ]
    : [
        { label: "Team Status", value: isInTeam ? "Joined" : "No Team" },
        {
          label: "Submission",
          value: isSubmitted ? "Submitted ✓" : hasSubmission ? "Draft" : "Not Started",
        },
      ];

  const recentActivities = [
    ...teams.map((t) => ({
      id: `team-${t.id}`,
      timeAgo: "Recently",
      description: `Team ${t.name} was created.`,
    })),
    ...members.slice(0, 3).map((m) => ({
      id: `mem-${m.user_id}`,
      timeAgo: "Recently",
      description: `A new ${m.role.toLowerCase()} joined the event.`,
    })),
  ].slice(0, 5);

  const judgeCount = members.filter((m) => m.role === "Judge").length;

  return (
    <div className="space-y-6">
      {/* Error display */}
      {actionError && (
        <div
          className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 flex items-center justify-between"
          role="alert"
        >
          <p className="text-sm text-[var(--error)]">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-xs text-[var(--error)] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Draft pre-publish checklist — visible only in Draft state and only to organizers */}
      {isOrganizer && event.state === "Draft" && (
        <PublishChecklist
          hasPrizePool={(event.prize_pool_target as number) > 0}
          hasDeadline={!!event.registration_deadline}
          hasJudges={judgeCount > 0}
          prizeAmount={event.prize_pool_target as number | null}
          eventId={event.id as string}
        />
      )}

      {/* Overview action center */}
      <EventActionCenter
        eventName={event.title as string}
        currentPhase={event.state as string}
        countdownText={(() => {
          const deadline = event.registration_deadline as string | null;
          if (!deadline) return "Deadline to be announced";
          // eslint-disable-next-line react-hooks/purity
          const ms = new Date(deadline).getTime() - Date.now();
          if (ms <= 0) return "Registration closed";
          const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
          if (days === 1) return "1 day left to register";
          return `${days} days left to register`;
        })()}
        heroPrimaryActionLabel={!myMembership ? "Apply to Participate" : "Continue Workspace"}
        onHeroPrimaryAction={
          !myMembership
            ? () => router.push(`/events/${event.id}/register`)
            : () => router.push(`/events/${event.id as string}/submissions`)
        }
        role={roleName}
        milestones={milestones}
        quickActions={quickActions}
        roleStats={roleStats}
        announcements={[]}
        activities={recentActivities}
      />

      {/* Organizer lifecycle controls */}
      {isOrganizer && (
        <div className="space-y-4 pt-2 border-t border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text)]">Lifecycle Controls</h2>

          <div className="flex flex-wrap gap-2">
            {event.state === "Draft" && (
              <>
                <ActionButton
                  label="Submit for Review"
                  onClick={() => handleStateChange("Review")}
                  disabled={loading}
                />
                <ActionButton
                  label="Publish Event"
                  hint="Requires a prize pool and registration deadline"
                  onClick={() => handleStateChange("Published")}
                  disabled={loading}
                />
                <a
                  href={`/events/${event.id as string}/edit`}
                  className="inline-flex flex-col gap-0.5"
                >
                  <span className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors">
                    Edit Event
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] px-1">
                    Update title, prize pool, deadline
                  </span>
                </a>
              </>
            )}
            {event.state === "Review" && (
              <>
                <ActionButton
                  label="Publish Event"
                  hint="Approve and make public"
                  onClick={() => handleStateChange("Published")}
                  disabled={loading}
                />
                <ActionButton
                  label="Revert to Draft"
                  onClick={() => handleStateChange("Draft")}
                  disabled={loading}
                />
              </>
            )}
            {event.state === "Published" && (
              <>
                <ActionButton
                  label="Open Registration"
                  onClick={() => handleStateChange("RegistrationOpen")}
                  disabled={loading}
                />
                <a
                  href={`/events/${event.id as string}/edit`}
                  className="inline-flex flex-col gap-0.5"
                >
                  <span className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors">
                    Edit Event
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] px-1">
                    Still editable before registration opens
                  </span>
                </a>
              </>
            )}
            {event.state === "RegistrationOpen" && (
              <ActionButton
                label="Close Registration"
                onClick={() => handleStateChange("RegistrationClosed")}
                disabled={loading}
              />
            )}
            {event.state === "RegistrationClosed" && (
              <ActionButton
                label="Lock Team Formation"
                hint="Prevent participants from leaving/joining teams"
                onClick={() => handleStateChange("TeamFormationLocked")}
                disabled={loading}
              />
            )}
            {event.state === "TeamFormationLocked" && (
              <ActionButton
                label="Open Submissions"
                hint="Allow teams to submit their projects"
                onClick={() => handleStateChange("SubmissionOpen")}
                disabled={loading}
              />
            )}
            {event.state === "SubmissionOpen" && (
              <ActionButton
                label="Close Submissions"
                onClick={() => handleStateChange("SubmissionClosed")}
                disabled={loading}
              />
            )}
            {event.state === "SubmissionClosed" && (
              <ActionButton
                label="Begin Judging (Round 1)"
                hint="Requires at least one submission"
                onClick={() => handleStateChange("JudgingRound1")}
                disabled={loading}
              />
            )}
            {event.state === "JudgingRound1" && (
              <>
                <ActionButton
                  label="Promote to Round 2"
                  hint="Move top teams to a second judging round"
                  onClick={() => handleStateChange("JudgingRound2")}
                  disabled={loading}
                />
                <ActionButton
                  label="Skip Round 2 (Verify Winners)"
                  hint="Directly verify winners without a second round"
                  onClick={() => handleStateChange("WinnerVerification")}
                  disabled={loading}
                />
              </>
            )}
            {event.state === "JudgingRound2" && (
              <ActionButton
                label="Verify Winners"
                hint="All Round 2 submissions must be scored"
                onClick={() => handleStateChange("WinnerVerification")}
                disabled={loading}
              />
            )}
            {event.state === "WinnerVerification" && (
              <ActionButton
                label="Open Dispute Window"
                hint="Allow participants to flag issues"
                onClick={() => handleStateChange("DisputeWindow")}
                disabled={loading}
              />
            )}
            {event.state === "DisputeWindow" && (
              <ActionButton
                label="Approve Prizes"
                hint="Requires zero unresolved disputes"
                onClick={() => handleStateChange("PrizeApproved")}
                disabled={loading}
              />
            )}
            {event.state === "PrizeApproved" && (
              <ActionButton
                label="Release Escrow"
                hint="Trigger on-chain payout to winners"
                onClick={() => handleStateChange("EscrowRelease")}
                disabled={loading}
              />
            )}
            {event.state === "EscrowRelease" && (
              <ActionButton
                label="Mark Completed"
                hint="Event is fully concluded"
                onClick={() => handleStateChange("Completed")}
                disabled={loading}
              />
            )}
            {event.state === "Completed" && (
              <ActionButton
                label="Archive Event"
                onClick={() => handleStateChange("Archived")}
                disabled={actionLoading}
              />
            )}
            {event.state !== "Completed" &&
              event.state !== "Cancelled" &&
              event.state !== "Archived" && (
                <button
                  onClick={() => {
                    if (confirm("Cancel this event? This cannot be undone."))
                      handleStateChange("Cancelled");
                  }}
                  className="rounded-md border border-[var(--error)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  Cancel Event
                </button>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

function PublishChecklist({
  hasPrizePool,
  hasDeadline,
  hasJudges,
  prizeAmount,
  eventId,
}: {
  hasPrizePool: boolean;
  hasDeadline: boolean;
  hasJudges: boolean;
  prizeAmount: number | null;
  eventId: string;
}) {
  const reqs = [
    { done: hasPrizePool, weight: 1 },
    { done: hasDeadline, weight: 1 },
    { done: hasJudges, weight: 1 },
    { done: true, weight: 1 }, // Basic details (completed in wizard)
  ];

  const completedCount = reqs.filter((r) => r.done).length;
  const totalCount = reqs.length;
  const percentage = Math.round((completedCount / totalCount) * 100);
  const allMet = completedCount === totalCount;

  return (
    <div className="card p-6 border-2 border-[var(--border)] bg-[var(--bg-elevated)] shadow-sm mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Pre-flight Checklist</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Complete these requirements to publish your event.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[var(--text)]">{percentage}%</div>
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
            Setup Complete
          </div>
        </div>
      </div>

      <div className="h-2 w-full bg-[var(--bg-muted)] rounded-full overflow-hidden mb-6">
        <div
          className={`h-full transition-all duration-500 ${allMet ? "bg-[var(--success,#22c55e)]" : "bg-[var(--accent)]"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Required Settings</h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ChecklistItem done={true} label="Basic details configured" />
          <ChecklistItem
            done={hasPrizePool}
            label={hasPrizePool ? `Prize pool set — ${prizeAmount} XLM` : "Set a prize pool amount"}
            action={
              !hasPrizePool ? (
                <a
                  href={`/events/${eventId}/edit`}
                  className="text-[11px] font-semibold text-[var(--accent)] hover:underline ml-auto bg-[var(--accent-muted)] px-2 py-1 rounded"
                >
                  Configure
                </a>
              ) : undefined
            }
          />
          <ChecklistItem
            done={hasDeadline}
            label={hasDeadline ? "Registration deadline set" : "Set a registration deadline"}
            action={
              !hasDeadline ? (
                <a
                  href={`/events/${eventId}/edit`}
                  className="text-[11px] font-semibold text-[var(--accent)] hover:underline ml-auto bg-[var(--accent-muted)] px-2 py-1 rounded"
                >
                  Configure
                </a>
              ) : undefined
            }
          />
          <ChecklistItem
            done={hasJudges}
            label={hasJudges ? "Judges assigned" : "Assign at least one judge"}
            action={
              !hasJudges ? (
                <a
                  href={`/events/${eventId}/members`}
                  className="text-[11px] font-semibold text-[var(--accent)] hover:underline ml-auto bg-[var(--accent-muted)] px-2 py-1 rounded"
                >
                  Assign
                </a>
              ) : undefined
            }
          />
        </ul>
      </div>

      {!allMet && (
        <div className="mt-6 p-3 rounded bg-[var(--warning-bg,#fffbeb)] border border-[var(--warning,#f59e0b)]/30">
          <p className="text-xs text-[var(--warning,#b45309)] font-medium flex items-center gap-2">
            <span className="font-bold">Blocking Issue:</span> Missing requirements prevent the
            event from being published.
          </p>
        </div>
      )}

      {allMet && (
        <div className="mt-6 p-4 rounded-lg bg-[var(--success,#22c55e)]/10 border border-[var(--success,#22c55e)]/30 text-center">
          <p className="text-sm font-semibold text-[var(--success,#16a34a)] mb-3">
            All requirements met! Your event is ready to go live.
          </p>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  action,
  optional,
}: {
  done: boolean;
  label: string;
  action?: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
          done
            ? "bg-[var(--success,#22c55e)] text-white"
            : optional
              ? "bg-[var(--bg-muted)] text-[var(--text-muted)]"
              : "bg-[var(--warning,#f59e0b)]/20 text-[var(--warning,#f59e0b)]"
        }`}
      >
        {done ? "✓" : optional ? "·" : "!"}
      </span>
      <span
        className={`text-xs flex-1 ${
          done
            ? "text-[var(--text-secondary)]"
            : optional
              ? "text-[var(--text-muted)]"
              : "text-[var(--text)]"
        }`}
      >
        {label}
      </span>
      {action}
    </li>
  );
}

function ActionButton({
  label,
  hint,
  onClick,
  disabled,
  variant = "primary",
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={onClick}
        disabled={disabled}
        title={hint}
        className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          variant === "secondary"
            ? "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
            : "border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)]"
        }`}
      >
        {label}
      </button>
      {hint && (
        <p className="text-[10px] text-[var(--text-muted)] px-1 max-w-[180px] leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}
