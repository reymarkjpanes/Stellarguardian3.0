import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import { EventWorkflowEngine } from "../event-workflow";
import type { EventRuleContext } from "../../business-rules/event-rules";
import type { EventState } from "@/types";

const ALL_EVENT_STATES: EventState[] = [
  "Draft", "Review", "Published", "RegistrationOpen", "RegistrationClosed",
  "TeamFormationLocked", "SubmissionOpen", "SubmissionClosed",
  "JudgingRound1", "JudgingRound2", "WinnerVerification", "DisputeWindow",
  "PrizeApproved", "EscrowRelease", "Completed", "Suspended", "Cancelled", "Archived"
];

function arbEventState(): fc.Arbitrary<EventState> {
  return fc.constantFrom(...ALL_EVENT_STATES);
}

function arbEventRuleContext(): fc.Arbitrary<EventRuleContext> {
  return fc.record({
    judgeCount: fc.nat({ max: 10 }),
    registrationDeadline: fc.option(fc.date().map(d => d.toISOString()), { nil: undefined }),
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
  it("Terminal states have no outbound transitions (except manual overrides)", () => {
    fc.assert(
      fc.property(arbEventRuleContext(), (ctx) => {
        const terminalStates: EventState[] = ["Completed", "Cancelled", "Archived"];
        
        for (const terminal of terminalStates) {
          const outbound = EventWorkflowEngine.getValidOutboundTransitions(terminal, ctx);
          if (terminal === "Completed" || terminal === "Cancelled" || terminal === "Suspended") {
            // Completed and Cancelled can go to Archived, but no business transitions
            expect(outbound.filter(s => s !== "Archived" && s !== "Cancelled" && s !== "Suspended")).toEqual([]);
          } else if (terminal === "Archived") {
            expect(outbound).toEqual([]);
          }
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

  it("Cannot transition to Review without judges", () => {
    fc.assert(
      fc.property(arbEventRuleContext(), (ctx) => {
        if (ctx.judgeCount === 0) {
          const result = EventWorkflowEngine.canTransition("Draft", "Review", ctx);
          expect(result.ok).toBe(false);
          expect(result.errors.some(e => e.includes("judge"))).toBe(true);
        }
      }),
      fcConfig
    );
  });
  
  it("Cannot transition to Published without escrow funding", () => {
    fc.assert(
      fc.property(arbEventRuleContext(), (ctx) => {
        if (!ctx.escrowFullyFundedOnChain) {
          const result = EventWorkflowEngine.canTransition("Review", "Published", ctx);
          expect(result.ok).toBe(false);
          expect(result.errors.some(e => e.includes("escrow") || e.includes("fund"))).toBe(true);
        }
      }),
      fcConfig
    );
  });
});
