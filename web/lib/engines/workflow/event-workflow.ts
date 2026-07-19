import { EventState } from "@/types";
import { EventBusinessRules, EventRuleContext } from "../business-rules/event-rules";

interface TransitionEdge {
  to: EventState;
  validators: Array<(ctx: EventRuleContext) => string | null>;
}

const TERMINAL_STATES = new Set<EventState>(["Completed", "Cancelled", "Archived"]);

/**
 * WORKFLOW_GRAPH defines the allowable state transitions and attaches
 * the necessary decoupled business rules to each edge.
 */
const WORKFLOW_GRAPH: Partial<Record<EventState, TransitionEdge[]>> = {
  Draft: [
    { to: "Review", validators: [EventBusinessRules.requiresJudges] }
  ],
  Review: [
    { to: "Published", validators: [EventBusinessRules.escrowFullyFunded] },
    { to: "Draft", validators: [] }
  ],
  Published: [
    { to: "RegistrationOpen", validators: [EventBusinessRules.requiresRegistrationDeadline] },
    { to: "Draft", validators: [] }
  ],
  RegistrationOpen: [
    { to: "RegistrationClosed", validators: [] },
    { to: "Published", validators: [EventBusinessRules.zeroRegistrations] }
  ],
  RegistrationClosed: [
    { to: "TeamFormationLocked", validators: [EventBusinessRules.minimumParticipantsMet] }
  ],
  TeamFormationLocked: [
    { to: "SubmissionOpen", validators: [] }
  ],
  SubmissionOpen: [
    { to: "SubmissionClosed", validators: [] },
    { to: "TeamFormationLocked", validators: [EventBusinessRules.zeroSubmissions] }
  ],
  SubmissionClosed: [
    { to: "JudgingRound1", validators: [EventBusinessRules.hasSubmissions] }
  ],
  JudgingRound1: [
    { to: "JudgingRound2", validators: [] },
    { to: "WinnerVerification", validators: [EventBusinessRules.allSubmissionsScored] }
  ],
  JudgingRound2: [
    { to: "WinnerVerification", validators: [EventBusinessRules.allSubmissionsScored] }
  ],
  WinnerVerification: [
    { to: "DisputeWindow", validators: [EventBusinessRules.kycSatisfied] }
  ],
  DisputeWindow: [
    { to: "PrizeApproved", validators: [EventBusinessRules.reviewWindowElapsed, EventBusinessRules.zeroUnresolvedDisputes] }
  ],
  PrizeApproved: [
    { to: "EscrowRelease", validators: [] }
  ],
  EscrowRelease: [
    { to: "Completed", validators: [] }
  ],
  Completed: [
    { to: "Archived", validators: [] }
  ],
  Suspended: [
    { to: "Archived", validators: [] }
  ],
  Cancelled: [
    { to: "Archived", validators: [] }
  ]
};

export const EventWorkflowEngine = {
  getValidOutboundTransitions: (from: EventState, ctx: EventRuleContext): EventState[] => {
    const edges = WORKFLOW_GRAPH[from] || [];
    const validEdges = edges.filter(edge => {
      return edge.validators.every(validator => validator(ctx) === null);
    });
    
    const validStates = validEdges.map(edge => edge.to);
    
    // Cancelled and Suspended can typically be reached from any non-terminal state via admin override
    if (!TERMINAL_STATES.has(from) && from !== "Suspended") {
      validStates.push("Cancelled", "Suspended");
    }
    
    return validStates;
  },
  
  canTransition: (from: EventState, to: EventState, ctx: EventRuleContext) => {
    const validStates = EventWorkflowEngine.getValidOutboundTransitions(from, ctx);
    if (!validStates.includes(to)) {
       const edges = WORKFLOW_GRAPH[from] || [];
       const targetEdge = edges.find(e => e.to === to);
       const errors: string[] = [];
       
       if (targetEdge) {
           targetEdge.validators.forEach(v => {
               const err = v(ctx);
               if (err) errors.push(err);
           });
       } else {
           errors.push(`No transition path from ${from} to ${to}`);
       }
       return { ok: false, errors, validOutbound: validStates };
    }
    return { ok: true, errors: [], validOutbound: validStates };
  }
};
