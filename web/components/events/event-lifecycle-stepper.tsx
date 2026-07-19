/**
 * EventLifecycleStepper — Phase-grouped 16-state lifecycle progress indicator.
 *
 * Design decisions:
 * - 16 states grouped into 5 meaningful phases (Setup, Registration, Execution, Judging, Settlement)
 * - Current state highlighted, completed phases collapsed to a single tick
 * - Terminal states (Cancelled, Archived) shown as divergent paths, not in main flow
 * - No decorative gradients — semantic color only
 * - Works for both organizers (full detail) and participants (simplified view)
 */
"use client";

type EventState =
  | "Draft" | "Published" | "RegistrationOpen" | "RegistrationClosed"
  | "TeamFormation" | "SubmissionOpen" | "SubmissionClosed" | "Judging"
  | "ReviewObjectionWindow" | "WinnersFinalized" | "OrganizerFundsEscrow"
  | "EscrowLocked" | "PrizeDistribution" | "Completed" | "Cancelled" | "Archived";

export type { EventState };

interface Phase {
  label: string;
  states: EventState[];
  description: string;
}

const PHASES: Phase[] = [
  {
    label: "Setup",
    states: ["Draft", "Published"],
    description: "Configure event details and assign judges",
  },
  {
    label: "Registration",
    states: ["RegistrationOpen", "RegistrationClosed", "TeamFormation"],
    description: "Accept participants and form teams",
  },
  {
    label: "Execution",
    states: ["SubmissionOpen", "SubmissionClosed"],
    description: "Participants build and submit their projects",
  },
  {
    label: "Judging",
    states: ["Judging", "ReviewObjectionWindow", "WinnersFinalized"],
    description: "Score submissions and resolve disputes",
  },
  {
    label: "Settlement",
    states: ["OrganizerFundsEscrow", "EscrowLocked", "PrizeDistribution", "Completed"],
    description: "Fund escrow and disburse prizes on-chain",
  },
];

// Human-readable state labels
const STATE_LABELS: Record<EventState, string> = {
  Draft: "Draft",
  Published: "Published",
  RegistrationOpen: "Registration Open",
  RegistrationClosed: "Registration Closed",
  TeamFormation: "Team Formation",
  SubmissionOpen: "Submissions Open",
  SubmissionClosed: "Submissions Closed",
  Judging: "Judging",
  ReviewObjectionWindow: "Review Window",
  WinnersFinalized: "Winners Set",
  OrganizerFundsEscrow: "Awaiting Funding",
  EscrowLocked: "Escrow Locked",
  PrizeDistribution: "Distributing Prizes",
  Completed: "Completed",
  Cancelled: "Cancelled",
  Archived: "Archived",
};

function getPhaseStatus(phase: Phase, currentState: EventState): "completed" | "current" | "upcoming" {
  const currentInPhase = phase.states.indexOf(currentState);
  if (currentInPhase !== -1) return "current";

  // Find which phase the current state is in
  for (const p of PHASES) {
    if (p.states.includes(currentState)) {
      const phaseIndex = PHASES.indexOf(phase);
      const currentPhaseIndex = PHASES.indexOf(p);
      return phaseIndex < currentPhaseIndex ? "completed" : "upcoming";
    }
  }
  return "upcoming";
}

function getCurrentStateInPhase(phase: Phase, currentState: EventState): EventState | null {
  return phase.states.includes(currentState) ? currentState : null;
}

interface EventLifecycleStepperProps {
  currentState: EventState;
  compact?: boolean;
}

export function EventLifecycleStepper({ currentState, compact = false }: EventLifecycleStepperProps) {
  const isTerminal = currentState === "Cancelled" || currentState === "Archived";

  if (isTerminal) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center gap-3">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-sm ${
            currentState === "Cancelled"
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
          }`}>
            {currentState === "Cancelled" ? "✕" : "✓"}
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text)]">{STATE_LABELS[currentState]}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {currentState === "Cancelled" ? "This event was cancelled." : "This event has been archived."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-4 space-y-1">
      {!compact && (
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Event Lifecycle
        </p>
      )}
      <div className="flex items-stretch gap-1">
        {PHASES.map((phase, phaseIdx) => {
          const status = getPhaseStatus(phase, currentState);
          const stateInPhase = getCurrentStateInPhase(phase, currentState);
          const isLast = phaseIdx === PHASES.length - 1;

          return (
            <div key={phase.label} className="flex items-center gap-1 flex-1 min-w-0">
              {/* Phase segment */}
              <div className={`flex-1 rounded-md px-2 py-2 min-w-0 ${
                status === "completed"
                  ? "bg-[var(--success-bg)]"
                  : status === "current"
                  ? "bg-[var(--accent-muted)] border border-[var(--accent)]"
                  : "bg-[var(--bg-muted)]"
              }`}>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold ${
                    status === "completed" ? "text-[var(--success)]"
                    : status === "current" ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)]"
                  }`}>
                    {status === "completed" ? "✓" : String(phaseIdx + 1)}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-semibold truncate leading-tight ${
                      status === "completed" ? "text-[var(--success)]"
                      : status === "current" ? "text-[var(--accent)]"
                      : "text-[var(--text-muted)]"
                    }`}>
                      {phase.label}
                    </p>
                    {status === "current" && stateInPhase && !compact && (
                      <p className="text-[10px] text-[var(--text-secondary)] truncate leading-tight mt-0.5">
                        {STATE_LABELS[stateInPhase]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {/* Connector */}
              {!isLast && (
                <div className={`w-2 h-px flex-shrink-0 ${
                  status === "completed" ? "bg-[var(--success)]" : "bg-[var(--border)]"
                }`} />
              )}
            </div>
          );
        })}
      </div>
      {/* Current state detail */}
      {!compact && (
        <div className="pt-2 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">Current state</span>
            <span className="text-xs font-medium text-[var(--text)]">{STATE_LABELS[currentState]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
