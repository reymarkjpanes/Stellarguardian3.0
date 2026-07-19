/**
 * Event state badge — visual indicator for the 16-state lifecycle.
 * Color-coded by phase: setup (neutral), active (blue), financial (amber), terminal (muted).
 */

const STATE_STYLES: Record<string, string> = {
  Draft: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  Published: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  RegistrationOpen: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300",
  RegistrationClosed: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  TeamFormation: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
  SubmissionOpen: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300",
  SubmissionClosed: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Judging: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300",
  ReviewObjectionWindow: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  WinnersFinalized: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  OrganizerFundsEscrow: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  EscrowLocked: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  PrizeDistribution: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Completed: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  Cancelled: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  Archived: "bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500",
};

const STATE_LABELS: Record<string, string> = {
  RegistrationOpen: "Registration Open",
  RegistrationClosed: "Registration Closed",
  TeamFormation: "Team Formation",
  SubmissionOpen: "Submissions Open",
  SubmissionClosed: "Submissions Closed",
  ReviewObjectionWindow: "Review Window",
  WinnersFinalized: "Winners Finalized",
  OrganizerFundsEscrow: "Awaiting Funding",
  EscrowLocked: "Escrow Locked",
  PrizeDistribution: "Prize Distribution",
};

interface EventStateBadgeProps {
  state: string;
  size?: "sm" | "md";
}

export function EventStateBadge({ state, size = "sm" }: EventStateBadgeProps) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.Draft;
  const label = STATE_LABELS[state] ?? state;
  const sizeClass = size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]";

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${style} ${sizeClass}`}>
      {label}
    </span>
  );
}
