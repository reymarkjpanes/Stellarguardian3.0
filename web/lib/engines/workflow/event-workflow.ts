import { EventState } from "@/types";
import { EventBusinessRules, EventRuleContext } from "../business-rules/event-rules";

interface TransitionEdge {
  to: EventState;
  validators: Array<(ctx: EventRuleContext) => string | null>;
}

const TERMINAL_STATES = new Set<EventState>(["Archived"]);

/**
 * WORKFLOW_GRAPH defines the allowable state transitions for the top-level Event Lifecycle
 * and attaches the necessary decoupled business rules to each edge.
 * 
 * Note: Operational phase transitions (Registration -> Submission, etc.) are managed
 * separately by EventPhase constraints, allowing the Event Lifecycle to remain stable.
 */
const WORKFLOW_GRAPH: Partial<Record<EventState, TransitionEdge[]>> = {
  Draft: [
    { to: "Active", validators: [EventBusinessRules.escrowFullyFunded, EventBusinessRules.requiresJudges, EventBusinessRules.requiresRegistrationDeadline] },
    { to: "Cancelled", validators: [] }
  ],
  Active: [
    { to: "Completed", validators: [EventBusinessRules.allSubmissionsScored, EventBusinessRules.zeroUnresolvedDisputes, EventBusinessRules.kycSatisfied] },
    { to: "Cancelled", validators: [] },
    { to: "Archived", validators: [] }
  ],
  Completed: [
    { to: "Archived", validators: [] }
  ],
  Cancelled: [
    { to: "Archived", validators: [] }
  ],
  Archived: []
};

export const EventWorkflowEngine = {
  getValidOutboundTransitions: (from: EventState, ctx: EventRuleContext): EventState[] => {
    const edges = WORKFLOW_GRAPH[from] || [];
    const validEdges = edges.filter(edge => {
      return edge.validators.every(validator => validator(ctx) === null);
    });
    
    return validEdges.map(edge => edge.to);
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
