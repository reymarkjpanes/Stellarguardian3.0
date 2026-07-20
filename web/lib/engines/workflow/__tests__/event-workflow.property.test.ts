import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import { EventWorkflowEngine } from "../event-workflow";
import type { EventRuleContext } from "../../business-rules/event-rules";
import type { EventState } from "@/types";

const ALL_EVENT_STATES: EventState[] = [
  "Draft", "Active", "Completed", "Cancelled", "Archived"
];

function arbEventState(): fc.Arbitrary<EventState> {
  return fc.constantFrom(...ALL_EVENT_STATES);
}

function arbEventRuleContext(): fc.Arbitrary<EventRuleContext> {
  return fc.record({
    judgeCount: fc.nat({ max: 10 }),
    registrationDeadline: fc.option(fc.date({min: new Date('2020-01-01'), max: new Date('2050-01-01')}).map(d => d.toISOString()), { nil: undefined }),
    teamSizeMin: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
    hasSubmissions: fc.boolean(),
    allSubmissionsScored: fc.boolean(),
    escrowFullyFundedOnChain: fc.boolean(),
    reviewWindowElapsed: fc.boolean(),
    unresolvedDisputes: fc.nat({ max: 5 }),
    registrationCount: fc.nat({ max: 100 }),
    submissionCount: fc.nat({ max: 100 }),
    kycRequirementsSatisfied: fc.boolean(),
    minimumParticipantsMet: fc.boolean(),
  });
}

describe("Property tests: Event Workflow Engine", () => {
  it("Terminal states have no outbound transitions", () => {
    fc.assert(
      fc.property(arbEventRuleContext(), (ctx) => {
        const terminalStates: EventState[] = ["Archived"];
        
        for (const terminal of terminalStates) {
          const outbound = EventWorkflowEngine.getValidOutboundTransitions(terminal, ctx);
          expect(outbound).toEqual([]);
        }
      }),
      fcConfig
    );
  });

  it("canTransition always agrees with getValidOutboundTransitions", () => {
    fc.assert(
      fc.property(arbEventState(), arbEventState(), arbEventRuleContext(), (from, to, ctx) => {
        const outbound = EventWorkflowEngine.getValidOutboundTransitions(from, ctx);
        const result = EventWorkflowEngine.canTransition(from, to, ctx);
        
        if (outbound.includes(to)) {
          expect(result.ok).toBe(true);
          expect(result.errors).toEqual([]);
        } else {
          expect(result.ok).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      }),
      fcConfig
    );
  });

  it("Cannot transition to Active without judges, deadline, and escrow", () => {
    fc.assert(
      fc.property(arbEventRuleContext(), (ctx) => {
        if (ctx.judgeCount === 0 || !ctx.registrationDeadline || !ctx.escrowFullyFundedOnChain) {
          const result = EventWorkflowEngine.canTransition("Draft", "Active", ctx);
          expect(result.ok).toBe(false);
          if (ctx.judgeCount === 0) expect(result.errors.some(e => e.includes("judge"))).toBe(true);
          if (!ctx.escrowFullyFundedOnChain) expect(result.errors.some(e => e.includes("escrow") || e.includes("fund"))).toBe(true);
        }
      }),
      fcConfig
    );
  });
  
  it("Cannot transition to Completed without scoring, zero disputes, and KYC", () => {
    fc.assert(
      fc.property(arbEventRuleContext(), (ctx) => {
        if (!ctx.allSubmissionsScored || ctx.unresolvedDisputes > 0 || !ctx.kycRequirementsSatisfied) {
          const result = EventWorkflowEngine.canTransition("Active", "Completed", ctx);
          expect(result.ok).toBe(false);
        }
      }),
      fcConfig
    );
  });
});
