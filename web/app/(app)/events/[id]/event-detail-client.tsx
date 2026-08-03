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
import { ConfirmTransitionModal } from "@/components/events/confirm-transition-modal";
import {
  validEventOutboundStates,
  canEventTransition,
  type EventTransitionContext,
} from "@/lib/state-machine/event";
import type { EventState, PlatformRole } from "@/types";

interface EventDetailClientProps {
  event: Record<string, unknown>;
  members: Array<{ user_id: string; role: string; availability: string }>;
  teams: Array<{
    id: string;
    name: string;
    captain_id: string;
    team_members: Array<{ user_id: string; joined_at: string }>;
  }>;
  isOrganizer: boolean;
  myMembership: { user_id: string; role: string; availability: string } | null;
  userId: string | null;
  judgeCount: number;
  hasVerifiedOrganizer: boolean;
  hasVerifiedWallet: boolean;
  submissionStatus: string | null;
  reviewWindowHours: number;
}

interface TransitionConfig {
  label: string;
  hint?: string;
  isHighRisk?: boolean;
  riskWarning?: string;
  variant?: "primary" | "secondary" | "danger";
}

function getTransitionConfig(from: EventState, to: EventState): TransitionConfig {
  if (to === "Cancelled") {
    return {
      label: "Cancel Event",
      isHighRisk: true,
      riskWarning: "Cancel this event? This action cannot be undone.",
      variant: "danger",
    };
  }

  switch (from) {
    case "Draft":
      if (to === "Review") return { label: "Submit for Review" };
      if (to === "Published")
        return { label: "Publish Event", hint: "Requires a prize pool and registration deadline" };
      break;
    case "Review":
      if (to === "Published") return { label: "Publish Event", hint: "Approve and make public" };
      if (to === "Draft") return { label: "Revert to Draft" };
      break;
    case "Published":
      if (to === "RegistrationOpen") return { label: "Open Registration" };
      break;
    case "RegistrationOpen":
      if (to === "RegistrationClosed") return { label: "Close Registration" };
      break;
    case "RegistrationClosed":
      if (to === "TeamFormationLocked")
        return {
          label: "Lock Team Formation",
          hint: "Prevent participants from leaving/joining teams",
          isHighRisk: true,
          riskWarning:
            "Lock team formation? Participants will no longer be able to join or leave teams.",
        };
      if (to === "SubmissionOpen")
        return { label: "Open Submissions", hint: "Allow teams to submit their projects" };
      break;
    case "TeamFormationLocked":
      if (to === "SubmissionOpen")
        return { label: "Open Submissions", hint: "Allow teams to submit their projects" };
      break;
    case "SubmissionOpen":
      if (to === "SubmissionClosed")
        return {
          label: "Close Submissions",
          hint: "Lock submission edits for judging",
          isHighRisk: true,
          riskWarning:
            "Close submissions? Participants will no longer be able to edit or submit projects.",
        };
      break;
    case "SubmissionClosed":
      if (to === "JudgingRound1")
        return {
          label: "Begin Judging (Round 1)",
          hint: "Requires at least one submission",
          isHighRisk: true,
          riskWarning: "Begin judging? Submissions will be locked and judges can start scoring.",
        };
      break;
    case "JudgingRound1":
      if (to === "JudgingRound2")
        return { label: "Promote to Round 2", hint: "Move top teams to a second judging round" };
      if (to === "WinnerVerification")
        return {
          label: "Skip Round 2 (Verify Winners)",
          hint: "Directly verify winners without a second round",
        };
      break;
    case "JudgingRound2":
      if (to === "WinnerVerification")
        return { label: "Verify Winners", hint: "All Round 2 submissions must be scored" };
      break;
    case "WinnerVerification":
      if (to === "DisputeWindow")
        return { label: "Open Dispute Window", hint: "Allow participants to flag issues" };
      break;
    case "DisputeWindow":
      if (to === "PrizeApproved")
        return { label: "Approve Prizes", hint: "Requires zero unresolved disputes" };
      break;
    case "PrizeApproved":
      if (to === "EscrowRelease")
        return {
          label: "Release Escrow",
          hint: "Trigger on-chain payout to winners",
          isHighRisk: true,
          riskWarning: "Release escrow? Payouts will be submitted on-chain for processing.",
        };
      break;
    case "EscrowRelease":
      if (to === "Completed")
        return {
          label: "Mark Completed",
          hint: "Event is fully concluded",
          isHighRisk: true,
          riskWarning:
            "Mark event as completed? This will reveal judge feedback to participants and conclude the event.",
        };
      break;
    case "Completed":
      if (to === "Archived") return { label: "Archive Event" };
      break;
    case "Cancelled":
      if (to === "Archived") return { label: "Archive Event" };
      break;
  }

  return {
    label: `Transition to ${to}`,
  };
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

  const [pendingModalState, setPendingModalState] = useState<{
    isOpen: boolean;
    targetState: EventState | null;
    title: string;
    targetStateName: string;
    riskWarning?: string;
    actionLabel: string;
  }>({
    isOpen: false,
    targetState: null,
    title: "",
    targetStateName: "",
    riskWarning: undefined,
    actionLabel: "Confirm",
  });

  const loading = actionLoading || isPending;

  async function handleStateChange(newState: EventState) {
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
    // Deduplicate by user_id so an organizer who self-assigned as judge
    // doesn't appear twice. Key includes role to stay unique in the array
    // before dedup, then we filter to one entry per user.
    ...Array.from(
      new Map(
        members
          .slice(0, 10)
          .map((m) => [m.user_id, m])
      ).values()
    )
      .slice(0, 3)
      .map((m, i) => ({
        id: `mem-${m.user_id}-${i}`,
        timeAgo: "Recently",
        description: `A new ${m.role.toLowerCase()} joined the event.`,
      })),
  ].slice(0, 5);

  const judgeCount = members.filter((m) => m.role === "Judge").length;

  const currentState = (event.state as EventState) || "Draft";

  const transitionCtx: EventTransitionContext = {
    actorRole: (isOrganizer ? "Organizer" : myMembership?.role) as PlatformRole,
    judgeCount: judgeCount,
    hasRegistrationDeadline: !!event.registration_deadline,
    allParticipantsAssigned: true,
    teamSizeMet: true,
    hasSubmissions: hasSubmission || teams.length > 0,
    allSubmissionsScored: true,
    reviewWindowElapsed: true,
    unresolvedDisputes: 0,
    winnersConfirmed: true,
    escrowFullyFunded: true,
    escrowLocked: true,
    allDisbursementsComplete: true,
    hasFunding: ((event.prize_pool_target as number) ?? 0) > 0,
  };

  // Dynamic outbound transitions derived from state-machine event.ts
  const availableOutboundStates = isOrganizer
    ? validEventOutboundStates(currentState, {
        ...transitionCtx,
        actorRole: "Organizer",
        judgeCount: Math.max(judgeCount, 1),
        hasRegistrationDeadline: true,
      })
    : [];

  function onTransitionClick(targetState: EventState) {
    // Validate transition via state-machine engine
    canEventTransition(currentState, targetState, transitionCtx);
    const config = getTransitionConfig(currentState, targetState);

    if (config.isHighRisk) {
      setPendingModalState({
        isOpen: true,
        targetState,
        title: `Confirm ${config.label}`,
        targetStateName: config.label,
        riskWarning: config.riskWarning,
        actionLabel: config.label,
      });
    } else {
      handleStateChange(targetState);
    }
  }

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

      {/* H2: Wallet verification nudge for participants during judging/winner phases */}
      {!isOrganizer &&
        myMembership?.role === "Participant" &&
        !hasVerifiedWallet &&
        (currentState === "JudgingRound1" ||
          currentState === "JudgingRound2" ||
          currentState === "WinnerVerification" ||
          currentState === "DisputeWindow") && (
          <div
            role="alert"
            className="rounded-md border border-[var(--warning)] bg-[var(--warning-bg)] px-4 py-3 flex items-start gap-3"
          >
            <span className="text-[var(--warning)] text-base shrink-0 mt-0.5">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--warning)]">
                Connect your wallet to receive prize payouts
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Winners need a verified Stellar wallet on file. Without one, your prize will be held
                until a wallet is connected.
              </p>
            </div>
            <a
              href="/settings"
              className="shrink-0 rounded-md border border-[var(--warning)] px-3 py-1.5 text-xs font-medium text-[var(--warning)] hover:bg-[var(--warning)] hover:text-white transition-colors"
            >
              Connect Wallet
            </a>
          </div>
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
      {isOrganizer && availableOutboundStates.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text)]">Lifecycle Controls</h2>

          <div className="flex flex-wrap gap-2">
            {availableOutboundStates.map((targetState) => {
              const config = getTransitionConfig(currentState, targetState);
              return (
                <ActionButton
                  key={targetState}
                  label={config.label}
                  hint={config.hint}
                  onClick={() => onTransitionClick(targetState)}
                  disabled={loading}
                  variant={config.variant === "danger" ? "danger" : "primary"}
                />
              );
            })}

            {(currentState === "Draft" || currentState === "Published") && (
              <a
                href={`/events/${event.id as string}/edit`}
                className="inline-flex flex-col gap-0.5"
              >
                <span className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors">
                  Edit Event
                </span>
                <span className="text-[10px] text-[var(--text-muted)] px-1">
                  {currentState === "Draft"
                    ? "Update title, prize pool, deadline"
                    : "Still editable before registration opens"}
                </span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Confirmation modal for high-risk state transitions */}
      <ConfirmTransitionModal
        isOpen={pendingModalState.isOpen}
        onClose={() => setPendingModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={async () => {
          const target = pendingModalState.targetState;
          setPendingModalState((prev) => ({ ...prev, isOpen: false }));
          if (target) {
            await handleStateChange(target);
          }
        }}
        title={pendingModalState.title}
        targetState={pendingModalState.targetState ?? undefined}
        targetStateName={pendingModalState.targetStateName}
        riskWarning={pendingModalState.riskWarning}
        actionLabel={pendingModalState.actionLabel}
        loading={loading}
      />
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
  const router = useRouter();
  const [assigningself, setAssigningSelf] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const handleSelfAssign = async () => {
    setAssigningSelf(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/self-assign-judge`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.data?.success) {
        router.refresh();
      } else {
        setAssignError(json.error?.message ?? "Failed to assign yourself as judge.");
      }
    } catch {
      setAssignError("Network error. Please try again.");
    } finally {
      setAssigningSelf(false);
    }
  };

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
                <JudgeAssignAction
                  eventId={eventId}
                  assigning={assigningself}
                  error={assignError}
                  onSelfAssign={handleSelfAssign}
                  onDismissError={() => setAssignError(null)}
                />
              ) : undefined
            }
          />
        </ul>

        {/* Inline error for self-assign — shown below the grid so it doesn't break layout */}
        {assignError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-md border border-[var(--error)]/40 bg-[var(--error-bg,#fef2f2)] px-3 py-2 text-xs text-[var(--error,#dc2626)]"
          >
            <span>{assignError}</span>
            <button
              onClick={() => setAssignError(null)}
              className="hover:underline shrink-0"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}
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

/**
 * Inline judge-assign action shown in the Pre-flight Checklist when no
 * judges are assigned yet. Gives the organizer two options without
 * navigating away:
 *   1. "Assign myself" — one-click self-assign via server action
 *   2. "Manage members" — link to the full members management view
 */
function JudgeAssignAction({
  eventId,
  assigning,
  error,
  onSelfAssign,
  onDismissError,
}: {
  eventId: string;
  assigning: boolean;
  error: string | null;
  onSelfAssign: () => void;
  onDismissError: () => void;
}) {
  return (
    <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
      <button
        onClick={onSelfAssign}
        disabled={assigning}
        className="text-[11px] font-semibold text-[var(--accent)] hover:underline bg-[var(--accent-muted)] px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        title="Assign yourself as a judge for this event"
      >
        {assigning ? "Assigning…" : "Assign myself"}
      </button>
      <span className="text-[var(--text-muted)] text-[10px]">or</span>
      <a
        href={`/events/${eventId}/members?view=management`}
        className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] hover:underline bg-[var(--bg-muted)] px-2 py-1 rounded transition-colors"
        title="Open members management to assign a judge"
      >
        Manage members
      </a>
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
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={onClick}
        disabled={disabled}
        title={hint}
        className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          variant === "danger"
            ? "border-[var(--error)] text-[var(--error)] hover:bg-[var(--error-bg)]"
            : variant === "secondary"
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
