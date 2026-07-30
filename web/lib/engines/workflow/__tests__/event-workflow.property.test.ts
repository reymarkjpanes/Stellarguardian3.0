/**
 * Property tests for EventWorkflowEngine.
 * Updated (Task 0.3) to use the canonical 10-state model.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import { EventWorkflowEngine } from "../event-workflow";
import type { EventRuleContext } from "../../business-rules/event-rules";
import type { EventState } from "@/types";

const ALL_EVENT_STATES: EventState[] = [
  "Draft",
  "Published",
  "RegistrationOpen",
  "RegistrationClosed",
  "SubmissionOpen",
  "SubmissionClosed",
  "Judging",
  "Completed",
  "Cancelled",
  "Archived",
];

function arbEventState(): fc.Arbitrary<EventState> {
  return fc.constantFrom(...ALL_EVENT_STATES);
}

function arbEventRuleContext(): fc.Arbitrary<EventRuleContext> {
  return fc.record({
    judgeCount: fc.nat({ max: 10 }),
    registrationDeadline: fc.option(fc.constant("2025-12-31T00:00:00.000Z"), { nil: undefined }),
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
    prizePoolTarget: fc.integer({ min: 0, max: 10000 }),
  });
}

describe("Property tests: Event Workflow Engine", () => {
  // Feature: nextjs-platform-conversion, Property 1:
  // Archived (terminal) has no outbound transitions
  it("Archived has no outbound transitions", () => {
    fc.assert(
      fc.property(arbEventRuleContext(), (ctx) => {
        const outbound = EventWorkflowEngine.getValidOutboundTransitions("Archived", ctx);
        expect(outbound).toEqual([]);
      }),
      fcConfig,
    );
  });

  // Feature: nextjs-platform-conversion, Property 2:
  // canTransition always agrees with getValidOutboundTransitions
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
      fcConfig,
    );
  });

  // Feature: nextjs-platform-conversion, Property 3:
  // Cannot publish without judges and deadline
  it("Cannot transition Draft→Published without judges and deadline", () => {
    fc.assert(
      fc.property(arbEventRuleContext(), (ctx) => {
        if (ctx.judgeCount === 0 || !ctx.registrationDeadline) {
          const result = EventWorkflowEngine.canTransition("Draft", "Published", ctx);
          expect(result.ok).toBe(false);
          if (ctx.judgeCount === 0) {
            expect(result.errors.some((e) => e.toLowerCase().includes("judge"))).toBe(true);
          }
        }
      }),
      fcConfig,
    );
  });

  // Cannot transition to judging without submissions
  it("Cannot transition SubmissionClosed→Judging without submissions", () => {
    fc.assert(
      fc.property(arbEventRuleContext(), (ctx) => {
        if (!ctx.hasSubmissions) {
          const result = EventWorkflowEngine.canTransition("SubmissionClosed", "Judging", ctx);
          expect(result.ok).toBe(false);
        }
      }),
      fcConfig,
    );
  });
});
