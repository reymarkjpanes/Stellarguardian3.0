/**
 * Property tests for the dispute lifecycle state machine (tasks 14.2, 14.3).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import {
  canDisputeTransition,
  isDisputeTerminal,
  validDisputeOutboundStates,
  DISPUTE_TERMINAL,
} from "./dispute";
import type { DisputeState, PlatformRole } from "@/types";

const ALL_DISPUTE_STATES: DisputeState[] = [
  "Open", "UnderReview", "Upheld", "Dismissed", "Withdrawn",
];

const ALL_ROLES: PlatformRole[] = [
  "PlatformAdmin", "WorkspaceOwner", "WorkspaceAdmin", "Organizer",
  "Sponsor", "Judge", "Mentor", "Participant", "TeamCaptain", "TeamMember",
];

function arbDisputeState(): fc.Arbitrary<DisputeState> {
  return fc.constantFrom(...ALL_DISPUTE_STATES);
}

function arbRole(): fc.Arbitrary<PlatformRole> {
  return fc.constantFrom(...ALL_ROLES);
}

describe("Property tests: Dispute lifecycle state machine", () => {
  // Feature: nextjs-platform-conversion, Property 19: Disputes are filed as Open only by
  // accepted participants during the window (covered by service; state machine tests role gating)

  // Feature: nextjs-platform-conversion, Property 20: Dispute transitions are role-gated
  it("Property 20: Only authorized roles can trigger dispute transitions", () => {
    fc.assert(
      fc.property(arbDisputeState(), arbDisputeState(), arbRole(), fc.boolean(), (from, to, role, isFiler) => {
        const result = canDisputeTransition(from, to, role, isFiler);

        if (result.ok) {
          // The target state must appear in validOutbound
          const outbound = validDisputeOutboundStates(from, role, isFiler);
          expect(outbound).toContain(to);
        }

        // Withdrawn is only reachable by the filer
        if (to === "Withdrawn" && result.ok) {
          expect(isFiler).toBe(true);
        }
      }),
      fcConfig,
    );
  });

  it("Property 20 (supplement): Withdrawal is exclusively filer-gated", () => {
    fc.assert(
      fc.property(arbRole(), (role) => {
        // Non-filer cannot withdraw from Open
        const fromOpen = canDisputeTransition("Open", "Withdrawn", role, false);
        expect(fromOpen.ok).toBe(false);

        // Non-filer cannot withdraw from UnderReview
        const fromReview = canDisputeTransition("UnderReview", "Withdrawn", role, false);
        expect(fromReview.ok).toBe(false);

        // Filer CAN withdraw from Open
        const filerOpen = canDisputeTransition("Open", "Withdrawn", role, true);
        expect(filerOpen.ok).toBe(true);

        // Filer CAN withdraw from UnderReview
        const filerReview = canDisputeTransition("UnderReview", "Withdrawn", role, true);
        expect(filerReview.ok).toBe(true);
      }),
      fcConfig,
    );
  });

  it("Terminal dispute states have no outbound transitions", () => {
    fc.assert(
      fc.property(arbRole(), fc.boolean(), (role, isFiler) => {
        for (const terminal of DISPUTE_TERMINAL) {
          const outbound = validDisputeOutboundStates(terminal, role, isFiler);
          expect(outbound).toEqual([]);
        }
      }),
      fcConfig,
    );
  });

  it("isDisputeTerminal matches DISPUTE_TERMINAL membership", () => {
    fc.assert(
      fc.property(arbDisputeState(), (state) => {
        expect(isDisputeTerminal(state)).toBe(DISPUTE_TERMINAL.has(state));
      }),
      fcConfig,
    );
  });

  it("Resolve roles (Organizer, PlatformAdmin, WorkspaceAdmin) can uphold/dismiss from Open and UnderReview", () => {
    const resolveRoles: PlatformRole[] = ["Organizer", "PlatformAdmin", "WorkspaceAdmin"];

    fc.assert(
      fc.property(fc.constantFrom(...resolveRoles), fc.boolean(), (role, isFiler) => {
        // From Open -> Upheld
        expect(canDisputeTransition("Open", "Upheld", role, isFiler).ok).toBe(true);
        // From Open -> Dismissed
        expect(canDisputeTransition("Open", "Dismissed", role, isFiler).ok).toBe(true);
        // From UnderReview -> Upheld
        expect(canDisputeTransition("UnderReview", "Upheld", role, isFiler).ok).toBe(true);
        // From UnderReview -> Dismissed
        expect(canDisputeTransition("UnderReview", "Dismissed", role, isFiler).ok).toBe(true);
      }),
      fcConfig,
    );
  });

  it("Non-resolve roles (Participant, Judge, Sponsor, etc.) cannot uphold/dismiss", () => {
    const nonResolveRoles: PlatformRole[] = ["Participant", "Judge", "Sponsor", "Mentor", "TeamCaptain", "TeamMember"];

    fc.assert(
      fc.property(fc.constantFrom(...nonResolveRoles), fc.boolean(), (role, isFiler) => {
        expect(canDisputeTransition("Open", "Upheld", role, isFiler).ok).toBe(false);
        expect(canDisputeTransition("Open", "Dismissed", role, isFiler).ok).toBe(false);
        expect(canDisputeTransition("UnderReview", "Upheld", role, isFiler).ok).toBe(false);
        expect(canDisputeTransition("UnderReview", "Dismissed", role, isFiler).ok).toBe(false);
      }),
      fcConfig,
    );
  });
});
