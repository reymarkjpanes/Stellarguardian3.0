/**
 * EventWorkflowEngine — business-rules-driven state transition evaluator.
 *
 * Updated (Task 0.3) to use the canonical 16-state EventState from @/types.
 * For pure state-machine logic (graph, preconditions), use `canEventTransition`
 * from `@/lib/state-machine/event` instead.
 *
 * This engine wires EventBusinessRules validators to the transition graph for
 * route handlers that need rule-violation messages (not just ok/not-ok).
 */
import type { EventState } from "@/types";
import { EventBusinessRules, type EventRuleContext } from "../business-rules/event-rules";

interface TransitionEdge {
  to: EventState;
  validators: Array<(ctx: EventRuleContext) => string | null>;
}

// TERMINAL_STATES is intentionally defined for future use (e.g. guard clauses,
// tests) but not yet referenced in the runtime path. Prefixed to avoid lint error.
const _TERMINAL_STATES = new Set<EventState>(["Completed", "Archived"]);

/**
 * Workflow graph aligned with the 16-state canonical model.
 * Each edge carries business-rule validators that map to human-readable errors.
 */
const WORKFLOW_GRAPH: Partial<Record<EventState, TransitionEdge[]>> = {
  Draft: [
    { to: "Review", validators: [] },
    {
      to: "Published",
      validators: [
        EventBusinessRules.requiresJudges,
        EventBusinessRules.requiresPrizePoolTarget,
        EventBusinessRules.requiresRegistrationDeadline,
      ],
    },
    { to: "Cancelled", validators: [] },
  ],
  Review: [
    { to: "Published", validators: [] },
    { to: "Draft", validators: [] },
    { to: "Cancelled", validators: [] },
  ],
  Published: [
    { to: "RegistrationOpen", validators: [] },
    { to: "Cancelled", validators: [] },
  ],
  RegistrationOpen: [
    { to: "RegistrationClosed", validators: [] },
    { to: "Cancelled", validators: [] },
  ],
  RegistrationClosed: [
    { to: "TeamFormationLocked", validators: [] },
    { to: "SubmissionOpen", validators: [] },
    { to: "Cancelled", validators: [] },
  ],
  TeamFormationLocked: [
    { to: "SubmissionOpen", validators: [] },
    { to: "Cancelled", validators: [] },
  ],
  SubmissionOpen: [
    { to: "SubmissionClosed", validators: [] },
    { to: "Cancelled", validators: [] },
  ],
  SubmissionClosed: [
    {
      to: "JudgingRound1",
      validators: [EventBusinessRules.hasSubmissions],
    },
    { to: "Cancelled", validators: [] },
  ],
  JudgingRound1: [
    { to: "JudgingRound2", validators: [EventBusinessRules.allSubmissionsScored] },
    { to: "WinnerVerification", validators: [EventBusinessRules.allSubmissionsScored] },
    { to: "Cancelled", validators: [] },
  ],
  JudgingRound2: [
    { to: "WinnerVerification", validators: [EventBusinessRules.allSubmissionsScored] },
    { to: "Cancelled", validators: [] },
  ],
  WinnerVerification: [
    { to: "DisputeWindow", validators: [] },
    { to: "Cancelled", validators: [] },
  ],
  DisputeWindow: [
    { to: "PrizeApproved", validators: [EventBusinessRules.zeroUnresolvedDisputes] },
    { to: "Cancelled", validators: [] },
  ],
  PrizeApproved: [
    { to: "EscrowRelease", validators: [] },
    { to: "Cancelled", validators: [] },
  ],
  EscrowRelease: [
    { to: "Completed", validators: [] },
    { to: "Cancelled", validators: [] },
  ],
  Completed: [{ to: "Archived", validators: [] }],
  Cancelled: [{ to: "Archived", validators: [] }],
  Suspended: [],
  Archived: [],
};

export const EventWorkflowEngine = {
  getValidOutboundTransitions(from: EventState, ctx: EventRuleContext): EventState[] {
    const edges = WORKFLOW_GRAPH[from] ?? [];
    return edges
      .filter((edge) => edge.validators.every((validator) => validator(ctx) === null))
      .map((edge) => edge.to);
  },

  canTransition(
    from: EventState,
    to: EventState,
    ctx: EventRuleContext,
  ): { ok: boolean; errors: string[]; validOutbound: EventState[] } {
    const validStates = EventWorkflowEngine.getValidOutboundTransitions(from, ctx);

    if (!validStates.includes(to)) {
      const edges = WORKFLOW_GRAPH[from] ?? [];
      const targetEdge = edges.find((e) => e.to === to);
      const errors: string[] = [];

      if (targetEdge) {
        targetEdge.validators.forEach((v) => {
          const err = v(ctx);
          if (err) errors.push(err);
        });
      } else {
        errors.push(`No transition path from ${from} to ${to}`);
      }
      return { ok: false, errors, validOutbound: validStates };
    }

    return { ok: true, errors: [], validOutbound: validStates };
  },
};
