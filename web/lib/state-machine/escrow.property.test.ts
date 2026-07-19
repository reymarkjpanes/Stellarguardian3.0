/**
 * Property tests for the escrow lifecycle state machine (task 4.5).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import {
  canEscrowTransition,
  isEscrowTerminal,
  validEscrowOutboundStates,
  ESCROW_TERMINAL,
} from "./escrow";
import type { EscrowContext } from "./escrow";
import type { EscrowState, PlatformRole } from "@/types";

const ALL_ESCROW_STATES: EscrowState[] = [
  "PendingFunding", "PartiallyFunded", "FullyFunded", "Locked",
  "PendingRelease", "Released", "Refunded", "Failed", "Cancelled",
];

const FUNDING_ROLES: PlatformRole[] = ["Organizer", "WorkspaceOwner"];

function arbEscrowState(): fc.Arbitrary<EscrowState> {
  return fc.constantFrom(...ALL_ESCROW_STATES);
}

function arbEscrowContext(): fc.Arbitrary<EscrowContext> {
  return fc.record({
    cumulativeConfirmedDeposits: fc.nat({ max: 10000 }),
    fundingTarget: fc.integer({ min: 1, max: 10000 }),
    onChainBalance: fc.nat({ max: 10000 }),
    expectedBalance: fc.nat({ max: 10000 }),
    inconsistent: fc.boolean(),
    isAutomated: fc.boolean(),
    actorRole: fc.option(fc.constantFrom<PlatformRole>(...FUNDING_ROLES), { nil: undefined }),
    reviewWindowElapsed: fc.boolean(),
    unresolvedDisputes: fc.nat({ max: 5 }),
    disbursementComplete: fc.boolean(),
    disbursementRetriesExhausted: fc.boolean(),
    refundConfirmed: fc.boolean(),
    refundRetriesExhausted: fc.boolean(),
  });
}

describe("Property tests: Escrow lifecycle state machine", () => {
  // Feature: nextjs-platform-conversion, Property 12: Cumulative funding drives escrow state
  it("Property 12: Funding tier is driven by cumulativeConfirmedDeposits relative to fundingTarget", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 0, max: 20000 }),
        (target, deposits) => {
          const ctx: EscrowContext = {
            cumulativeConfirmedDeposits: deposits,
            fundingTarget: target,
            onChainBalance: deposits,
            expectedBalance: deposits,
            inconsistent: false,
            isAutomated: false,
            actorRole: "Organizer",
            reviewWindowElapsed: false,
            unresolvedDisputes: 0,
            disbursementComplete: false,
            disbursementRetriesExhausted: false,
            refundConfirmed: false,
            refundRetriesExhausted: false,
          };

          if (deposits >= target) {
            // Should be able to transition to FullyFunded
            const result = canEscrowTransition("PendingFunding", "FullyFunded", ctx);
            expect(result.ok).toBe(true);
          } else if (deposits > 0) {
            // Should be able to transition to PartiallyFunded
            const result = canEscrowTransition("PendingFunding", "PartiallyFunded", ctx);
            expect(result.ok).toBe(true);
            // Should NOT be able to go directly to FullyFunded
            const fullResult = canEscrowTransition("PendingFunding", "FullyFunded", ctx);
            expect(fullResult.ok).toBe(false);
          } else {
            // No deposits — cannot advance
            const partial = canEscrowTransition("PendingFunding", "PartiallyFunded", ctx);
            expect(partial.ok).toBe(false);
            const full = canEscrowTransition("PendingFunding", "FullyFunded", ctx);
            expect(full.ok).toBe(false);
          }
        },
      ),
      fcConfig,
    );
  });

  it("Terminal escrow states have no outbound transitions", () => {
    fc.assert(
      fc.property(arbEscrowContext(), (ctx) => {
        for (const terminal of ESCROW_TERMINAL) {
          const outbound = validEscrowOutboundStates(terminal, ctx);
          expect(outbound).toEqual([]);
        }
      }),
      fcConfig,
    );
  });

  it("isEscrowTerminal matches ESCROW_TERMINAL membership", () => {
    fc.assert(
      fc.property(arbEscrowState(), (state) => {
        expect(isEscrowTerminal(state)).toBe(ESCROW_TERMINAL.has(state));
      }),
      fcConfig,
    );
  });

  // Feature: nextjs-platform-conversion, Property 13: Reconciliation mismatch flags and blocks
  it("Property 13: Automated transitions are blocked when inconsistent flag is set", () => {
    fc.assert(
      fc.property(arbEscrowState(), (from) => {
        const ctx: EscrowContext = {
          cumulativeConfirmedDeposits: 5000,
          fundingTarget: 5000,
          onChainBalance: 5000,
          expectedBalance: 5000,
          inconsistent: true, // Flagged
          isAutomated: true, // Automated transition
          actorRole: undefined,
          reviewWindowElapsed: true,
          unresolvedDisputes: 0,
          disbursementComplete: true,
          disbursementRetriesExhausted: false,
          refundConfirmed: false,
          refundRetriesExhausted: false,
        };

        // For states that have automated transitions (FullyFunded->Locked, Locked->PendingRelease, PendingRelease->Released)
        if (from === "FullyFunded") {
          const result = canEscrowTransition(from, "Locked", ctx);
          expect(result.ok).toBe(false);
          expect(result.unmetPreconditions.some((p) => p.includes("inconsistent"))).toBe(true);
        }
        if (from === "Locked") {
          const result = canEscrowTransition(from, "PendingRelease", ctx);
          expect(result.ok).toBe(false);
          expect(result.unmetPreconditions.some((p) => p.includes("inconsistent"))).toBe(true);
        }
        if (from === "PendingRelease") {
          const result = canEscrowTransition(from, "Released", ctx);
          expect(result.ok).toBe(false);
          expect(result.unmetPreconditions.some((p) => p.includes("inconsistent"))).toBe(true);
        }
      }),
      fcConfig,
    );
  });

  it("canEscrowTransition is consistent with validEscrowOutboundStates", () => {
    fc.assert(
      fc.property(arbEscrowState(), arbEscrowContext(), (from, ctx) => {
        const outbound = validEscrowOutboundStates(from, ctx);
        for (const to of outbound) {
          const result = canEscrowTransition(from, to, ctx);
          expect(result.ok).toBe(true);
        }
      }),
      fcConfig,
    );
  });
});
