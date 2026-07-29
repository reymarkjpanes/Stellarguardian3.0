/**
 * EventLifecycleStepper — Phase-grouped 16-state lifecycle progress indicator (Task 0.3).
 *
 * Uses the canonical `EventState` from `@/types` — single source of truth.
 * Phase groupings map the 16 states into 5 logical phases with connectors.
 * Terminal states (Cancelled, Archived) rendered as a divergent end-state banner.
 * Semantically colored only — no decorative gradients.
 */
"use client";

import type { EventState } from "@/types";

export type { EventState };

interface Phase {
  label: string;
  states: EventState[];
  description: string;
}

/**
 * The canonical 5-phase grouping of the 16-state event lifecycle.
 * Phases map to DB states exactly — no local re-definition.
 */
const PHASES: Phase[] = [
  {
    label: "Setup",
    states: ["Draft", "Published"],
    description: "Configure event details and assign judges",
  },
  {
    label: "Registration",
    states: ["RegistrationOpen", "RegistrationClosed"],
    description: "Accept participants and form teams",
  },
  {
    label: "Execution",
    states: ["SubmissionOpen", "SubmissionClosed"],
    description: "Participants build and submit projects",
  },
  {
    label: "Judging",
    states: ["Judging"],
    description: "Score submissions and resolve disputes",
  },
  {
    label: "Completed",
    states: ["Completed"],
    description: "Approve prizes, release escrow, disburse on-chain",
  },
];

const STATE_LABELS: Record<EventState, string> = {
  Draft: "Draft",
  Published: "Published",
  RegistrationOpen: "Registration Open",
  RegistrationClosed: "Registration Closed",
  SubmissionOpen: "Submissions Open",
  SubmissionClosed: "Submissions Closed",
  Judging: "Judging",
  Completed: "Completed",
  Cancelled: "Cancelled",
  Archived: "Archived",
};

function getPhaseStatus(
  phase: Phase,
  currentState: EventState,
): "completed" | "current" | "upcoming" {
  if (phase.states.includes(currentState)) return "current";

  for (const p of PHASES) {
    if (p.states.includes(currentState)) {
      const phaseIndex = PHASES.indexOf(phase);
      const currentPhaseIndex = PHASES.indexOf(p);
      return phaseIndex < currentPhaseIndex ? "completed" : "upcoming";
    }
  }
  return "upcoming";
}

interface EventLifecycleStepperProps {
  currentState: EventState;
  compact?: boolean;
}

export function EventLifecycleStepper({
  currentState,
  compact = false,
}: EventLifecycleStepperProps) {
  const isTerminal = currentState === "Cancelled" || currentState === "Archived";

  if (isTerminal) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-7 w-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
              currentState === "Cancelled"
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
            }`}
          >
            {currentState === "Cancelled" ? "✕" : "✓"}
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text)]">{STATE_LABELS[currentState]}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {currentState === "Cancelled"
                ? "This event was cancelled."
                : "This event has been archived."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
      {!compact && (
        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
          Event Lifecycle
        </p>
      )}

      {/* Phase rail */}
      <div className="flex items-stretch gap-1">
        {PHASES.map((phase, phaseIdx) => {
          const status = getPhaseStatus(phase, currentState);
          const stateInPhase = phase.states.includes(currentState) ? currentState : null;
          const isLast = phaseIdx === PHASES.length - 1;

          return (
            <div key={phase.label} className="flex items-center gap-1 flex-1 min-w-0">
              <div
                className={`flex-1 rounded-md px-2 py-2 min-w-0 transition-colors ${
                  status === "completed"
                    ? "bg-[var(--success-bg)]"
                    : status === "current"
                      ? "bg-[var(--accent-muted)] border border-[var(--accent)]"
                      : "bg-[var(--bg-muted)]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold flex-shrink-0 ${
                      status === "completed"
                        ? "text-[var(--success)]"
                        : status === "current"
                          ? "text-[var(--accent)]"
                          : "text-[var(--text-muted)]"
                    }`}
                  >
                    {status === "completed" ? "✓" : String(phaseIdx + 1)}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-[11px] font-semibold truncate leading-tight ${
                        status === "completed"
                          ? "text-[var(--success)]"
                          : status === "current"
                            ? "text-[var(--accent)]"
                            : "text-[var(--text-muted)]"
                      }`}
                    >
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
                <div
                  className={`w-2 h-px flex-shrink-0 ${
                    status === "completed" ? "bg-[var(--success)]" : "bg-[var(--border)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current state label row */}
      {!compact && (
        <div className="pt-1 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">Current state</span>
          <span className="text-xs font-medium text-[var(--text)]">
            {STATE_LABELS[currentState]}
          </span>
        </div>
      )}
    </div>
  );
}
