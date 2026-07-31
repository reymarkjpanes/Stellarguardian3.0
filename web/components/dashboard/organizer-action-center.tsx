/**
 * OrganizerActionCenter — Smart task surface for event organizers.
 *
 * Key improvement over the old GlobalActionCenter:
 * - Old: 3 hardcoded checks (pending approvals, prize unfunded, judging)
 * - New: Derives tasks from real state machine preconditions.
 *   Tasks are ranked by urgency and are directly actionable.
 *   Each task explains WHY it matters (financial consequence), not just what to do.
 *
 * Task priority levels:
 * - blocking: event cannot progress without this (red)
 * - urgent: should be done soon to avoid delays (amber)
 * - suggested: improves trust/quality (blue/neutral)
 *
 * Design: compact card per task, direct action link, no bloat.
 */
"use client";

interface EventSummary {
  id: string;
  title: string;
  state: string;
  pendingMemberCount: number;
  judgeCount: number;
  hasWallet: boolean;
  escrowState: string | null;
  prizePoolTarget: number | null;
  submissionCount: number;
  evaluationCount: number;
}

interface Task {
  id: string;
  eventId: string;
  eventTitle: string;
  headline: string;
  consequence: string;
  actionLabel: string;
  actionHref: string;
  priority: "blocking" | "urgent" | "suggested";
}

function deriveTasksForEvent(event: EventSummary): Task[] {
  const tasks: Task[] = [];

  // Blocking: pending member approvals
  if (
    event.pendingMemberCount > 0 &&
    ["RegistrationOpen", "RegistrationClosed"].includes(event.state)
  ) {
    tasks.push({
      id: `approve-${event.id}`,
      eventId: event.id,
      eventTitle: event.title,
      headline: `${event.pendingMemberCount} application${event.pendingMemberCount > 1 ? "s" : ""} waiting`,
      consequence: "Participants cannot form teams until approved.",
      actionLabel: "Review Applications",
      actionHref: `/events/${event.id}/members`,
      priority: "blocking",
    });
  }

  // Blocking if Draft (can't publish) or SubmissionClosed (can't begin judging). Urgent otherwise.
  if (
    event.judgeCount === 0 &&
    [
      "Draft",
      "Published",
      "RegistrationOpen",
      "RegistrationClosed",
      "SubmissionOpen",
      "SubmissionClosed",
    ].includes(event.state)
  ) {
    const isBlocking = event.state === "Draft" || event.state === "SubmissionClosed";
    tasks.push({
      id: `judges-${event.id}`,
      eventId: event.id,
      eventTitle: event.title,
      headline: "No judges assigned",
      consequence: isBlocking
        ? event.state === "Draft"
          ? "You must assign at least one judge before publishing."
          : "You must assign at least one judge to begin judging."
        : "Assign at least one judge before submissions close.",
      actionLabel: "Assign Judges",
      actionHref: `/events/${event.id}/members`,
      priority: isBlocking ? "blocking" : "urgent",
    });
  }

  // Urgent: judging phase with unscored submissions
  if (
    (event.state === "JudgingRound1" || event.state === "JudgingRound2") &&
    event.submissionCount > 0 &&
    event.evaluationCount < event.submissionCount
  ) {
    const unscored = event.submissionCount - event.evaluationCount;
    tasks.push({
      id: `score-${event.id}`,
      eventId: event.id,
      eventTitle: event.title,
      headline: `${unscored} submission${unscored > 1 ? "s" : ""} need scoring`,
      consequence: "All submissions must be scored before winners can be finalized.",
      actionLabel: "Score Submissions",
      actionHref: `/events/${event.id}/judging`,
      priority: "urgent",
    });
  }

  // Suggested: wallet not connected
  if (!event.hasWallet && ["Draft", "Published"].includes(event.state)) {
    tasks.push({
      id: `wallet-${event.id}`,
      eventId: event.id,
      eventTitle: event.title,
      headline: "Connect a Stellar wallet",
      consequence: "You'll need a verified wallet to fund the escrow when the time comes.",
      actionLabel: "Connect Wallet",
      actionHref: "/settings",
      priority: "suggested",
    });
  }

  return tasks;
}

interface OrganizerActionCenterProps {
  events: EventSummary[];
}

export function OrganizerActionCenter({ events }: OrganizerActionCenterProps) {
  // Only care about non-terminal events
  const activeEvents = events.filter(
    (e) => !["Completed", "Cancelled", "Archived"].includes(e.state),
  );

  const allTasks = activeEvents.flatMap(deriveTasksForEvent);

  // Sort: blocking first, then urgent, then suggested
  const priorityOrder = { blocking: 0, urgent: 1, suggested: 2 };
  const sorted = allTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  if (sorted.length === 0) return null;

  const blockingCount = sorted.filter((t) => t.priority === "blocking").length;
  const urgentCount = sorted.filter((t) => t.priority === "urgent").length;

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Action Required</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {blockingCount > 0 && `${blockingCount} blocking`}
            {blockingCount > 0 && urgentCount > 0 && " · "}
            {urgentCount > 0 && `${urgentCount} urgent`}
          </p>
        </div>
        <span className="h-5 w-5 rounded-full bg-[var(--error-bg)] text-[var(--error)] text-xs font-bold flex items-center justify-center">
          {sorted.length}
        </span>
      </div>

      {/* Task list */}
      <div className="divide-y divide-[var(--border)]">
        {sorted.map((task) => (
          <div key={task.id} className="px-4 py-3 flex items-start gap-3">
            {/* Priority dot */}
            <div
              className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                task.priority === "blocking"
                  ? "bg-[var(--error)]"
                  : task.priority === "urgent"
                    ? "bg-[var(--warning)]"
                    : "bg-[var(--accent)]"
              }`}
            />
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium truncate">
                {task.eventTitle}
              </p>
              <p className="text-sm font-medium text-[var(--text)] mt-0.5">{task.headline}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                {task.consequence}
              </p>
            </div>
            {/* CTA */}
            <a
              href={task.actionHref}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                task.priority === "blocking"
                  ? "bg-[var(--error-bg)] text-[var(--error)] hover:opacity-80"
                  : task.priority === "urgent"
                    ? "bg-[var(--warning-bg)] text-[var(--warning)] hover:opacity-80"
                    : "bg-[var(--accent-muted)] text-[var(--accent)] hover:opacity-80"
              }`}
            >
              {task.actionLabel}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
