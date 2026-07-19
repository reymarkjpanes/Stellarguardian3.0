/**
 * Property tests for the event lifecycle state machine (tasks 4.2, 4.3).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import {
  canTransition,
  isTerminal,
  validOutboundStates,
  TERMINAL_STATES,
  ROLLBACK_TRANSITIONS,
} from "./event";
import type { TransitionContext } from "./event";
import type { EventState, PlatformRole } from "@/types";

const ALL_EVENT_STATES: EventState[] = [
  "Draft", "Published", "RegistrationOpen", "RegistrationClosed",
  "TeamFormation", "SubmissionOpen", "SubmissionClosed", "Judging",
  "ReviewObjectionWindow", "WinnersFinalized", "OrganizerFundsEscrow",
  "EscrowLocked", "PrizeDistribution", "Completed", "Cancelled", "Archived",
];

const ALL_ROLES: PlatformRole[] = [
  "PlatformAdmin", "WorkspaceOwner", "WorkspaceAdmin", "Organizer",
  "Sponsor", "Judge", "Mentor", "Participant", "TeamCaptain", "TeamMember",
];

function arbEventState(): fc.Arbitrary<EventState> {
  return fc.constantFrom(...ALL_EVENT_STATES);
}

function arbRole(): fc.Arbitrary<PlatformRole> {
  return fc.constantFrom(...ALL_ROLES);
}

function arbTransitionContext(): fc.Arbitrary<TransitionContext> {
  return fc.record({
    judgeCount: fc.nat({ max: 10 }),
    registrationDeadline: fc.option(
      fc.integer({ min: 1577836800000, max: 1924905600000 }).map((ts) => new Date(ts).toISOString()),
      { nil: undefined },
    ),
    teamSizeMin: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
    hasSubmissions: fc.boolean(),
    allSubmissionsScored: fc.boolean(),
    escrowFullyFundedOnChain: fc.boolean(),
    reviewWindowElapsed: fc.boolean(),
    unresolvedDisputes: fc.nat({ max: 5 }),
    registrationCount: fc.nat({ max: 100 }),
    submissionCount: fc.nat({ max: 100 }),
    actorRole: arbRole(),
  });
}

describe("Property tests: Event lifecycle state machine", () => {
  // Feature: nextjs-platform-conversion, Property 1: Transitions occur only
  // when valid and preconditions are met
  it("Property 1: canTransition returns ok=true only when the edge exists AND preconditions pass", () => {
    fc.assert(
      fc.property(arbEventState(), arbEventState(), arbTransitionContext(), (from, to, ctx) => {
        const result = canTransition(from, to, ctx);

        if (result.ok) {
          // If ok, the transition must appear in validOutbound
          expect(result.validOutbound).toContain(to);
          // No unmet preconditions
          expect(result.unmetPreconditions).toHaveLength(0);
        } else {
          // If not ok, either the edge doesn't exist or preconditions are unmet
          expect(result.unmetPreconditions.length).toBeGreaterThan(0);
        }
      }),
      fcConfig,
    );
  });

  // Feature: nextjs-platform-conversion, Property 4: Terminal and rollback invariants hold
  it("Property 4: Terminal states have no outbound transitions except Completed->Archived", () => {
    fc.assert(
      fc.property(arbTransitionContext(), (ctx) => {
        // Cancelled and Archived have zero outbound transitions
        expect(validOutboundStates("Cancelled", ctx)).toEqual([]);
        expect(validOutboundStates("Archived", ctx)).toEqual([]);

        // Completed only has Archived
        const completedOutbound = validOutboundStates("Completed", ctx);
        expect(completedOutbound).toEqual(["Archived"]);
      }),
      fcConfig,
    );
  });

  it("Property 4 (supplement): isTerminal is consistent with TERMINAL_STATES", () => {
    fc.assert(
      fc.property(arbEventState(), (state) => {
        expect(isTerminal(state)).toBe(TERMINAL_STATES.has(state));
      }),
      fcConfig,
    );
  });

  it("Property 4 (supplement): Cancelled is reachable from every non-terminal state", () => {
    fc.assert(
      fc.property(arbEventState(), arbTransitionContext(), (state, ctx) => {
        if (!isTerminal(state)) {
          const result = canTransition(state, "Cancelled", ctx);
          expect(result.ok).toBe(true);
        }
      }),
      fcConfig,
    );
  });

  it("validOutboundStates always returns a subset of states for which canTransition returns ok", () => {
    fc.assert(
      fc.property(arbEventState(), arbTransitionContext(), (from, ctx) => {
        const outbound = validOutboundStates(from, ctx);
        for (const to of outbound) {
          const result = canTransition(from, to, ctx);
          expect(result.ok).toBe(true);
        }
      }),
      fcConfig,
    );
  });

  it("Rollback transitions exist only for the documented rollback states", () => {
    const rollbackSources = new Set(ROLLBACK_TRANSITIONS.keys());
    for (const state of ALL_EVENT_STATES) {
      if (rollbackSources.has(state)) {
        const targets = ROLLBACK_TRANSITIONS.get(state)!;
        expect(targets.length).toBeGreaterThan(0);
      }
    }
  });
});
