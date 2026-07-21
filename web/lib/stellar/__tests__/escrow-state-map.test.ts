/**
 * Tests for escrow-state-map.ts — Backend↔Contract state consistency.
 *
 * Verifies:
 * 1. All backend states have a mapping (no missing entries)
 * 2. isStateConsistent correctly identifies matching/divergent states
 * 3. describeStateDivergence produces useful messages
 */
import { describe, it, expect } from "vitest";
import {
  BACKEND_TO_CONTRACT_STATE,
  CONTRACT_STATES,
  CONTRACT_STATE_LABELS,
  isStateConsistent,
  describeStateDivergence,
} from "../escrow-state-map";
import type { EscrowState } from "@/types";

const ALL_BACKEND_STATES: EscrowState[] = [
  "PendingFunding",
  "PartiallyFunded",
  "FullyFunded",
  "Locked",
  "PendingRelease",
  "Released",
  "Refunded",
  "Failed",
  "Cancelled",
];

describe("escrow-state-map", () => {
  describe("BACKEND_TO_CONTRACT_STATE mapping", () => {
    it("covers all 9 backend escrow states", () => {
      for (const state of ALL_BACKEND_STATES) {
        expect(BACKEND_TO_CONTRACT_STATE).toHaveProperty(state);
      }
    });

    it("maps PendingFunding to contract state 0", () => {
      expect(BACKEND_TO_CONTRACT_STATE.PendingFunding).toBe(CONTRACT_STATES.PendingFunding);
      expect(BACKEND_TO_CONTRACT_STATE.PendingFunding).toBe(0);
    });

    it("maps PendingRelease to Locked (3) — backend-only mutex", () => {
      expect(BACKEND_TO_CONTRACT_STATE.PendingRelease).toBe(CONTRACT_STATES.Locked);
      expect(BACKEND_TO_CONTRACT_STATE.PendingRelease).toBe(3);
    });

    it("maps Failed to null (no contract equivalent)", () => {
      expect(BACKEND_TO_CONTRACT_STATE.Failed).toBeNull();
    });

    it("maps Cancelled to Refunded (5)", () => {
      expect(BACKEND_TO_CONTRACT_STATE.Cancelled).toBe(CONTRACT_STATES.Refunded);
    });
  });

  describe("CONTRACT_STATE_LABELS", () => {
    it("has labels for all 6 contract states", () => {
      expect(Object.keys(CONTRACT_STATE_LABELS)).toHaveLength(6);
      expect(CONTRACT_STATE_LABELS[0]).toBe("PendingFunding");
      expect(CONTRACT_STATE_LABELS[4]).toBe("Released");
    });
  });

  describe("isStateConsistent", () => {
    it("returns true when backend and contract states match", () => {
      expect(isStateConsistent("PendingFunding", 0)).toBe(true);
      expect(isStateConsistent("FullyFunded", 2)).toBe(true);
      expect(isStateConsistent("Locked", 3)).toBe(true);
      expect(isStateConsistent("Released", 4)).toBe(true);
    });

    it("returns true for PendingRelease when contract is Locked (3)", () => {
      expect(isStateConsistent("PendingRelease", 3)).toBe(true);
    });

    it("returns true for Failed regardless of contract state (backend-only)", () => {
      expect(isStateConsistent("Failed", 0)).toBe(true);
      expect(isStateConsistent("Failed", 3)).toBe(true);
      expect(isStateConsistent("Failed", 5)).toBe(true);
    });

    it("returns false when states diverge", () => {
      expect(isStateConsistent("PendingFunding", 2)).toBe(false);
      expect(isStateConsistent("Locked", 4)).toBe(false);
      expect(isStateConsistent("Released", 3)).toBe(false);
    });

    it("returns false when FullyFunded but contract shows PendingFunding", () => {
      expect(isStateConsistent("FullyFunded", 0)).toBe(false);
    });
  });

  describe("describeStateDivergence", () => {
    it("produces a human-readable divergence description", () => {
      const msg = describeStateDivergence("FullyFunded", 0);
      expect(msg).toContain("FullyFunded");
      expect(msg).toContain("PendingFunding");
    });

    it("handles Failed state gracefully", () => {
      const msg = describeStateDivergence("Failed", 3);
      expect(msg).toContain("N/A (backend-only)");
      expect(msg).toContain("Locked");
    });
  });
});
