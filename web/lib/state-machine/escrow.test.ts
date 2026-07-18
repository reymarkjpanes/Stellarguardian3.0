/**
 * Sanity unit tests for the escrow lifecycle state machine (task 4.4).
 *
 * These are NOT the dedicated property test for Property 12 (that is a
 * separate task, 4.5) — just enough coverage to confirm the module compiles
 * correctly and behaves sanely: the cumulative-funding-driven progression
 * PendingFunding -> PartiallyFunded -> FullyFunded, and the `inconsistent`
 * flag blocking automated transitions (Req 26.7, Property 13 groundwork).
 */
import { describe, expect, it } from "vitest";
import { canEscrowTransition, isEscrowTerminal, validEscrowOutboundStates } from "./escrow";
import type { EscrowContext } from "./escrow";

const baseCtx: EscrowContext = {
  cumulativeConfirmedDeposits: 0,
  fundingTarget: 1000,
  onChainBalance: 0,
  expectedBalance: 0,
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

describe("escrow state machine sanity checks", () => {
  it("blocks PendingFunding -> PartiallyFunded before any deposit", () => {
    const result = canEscrowTransition("PendingFunding", "PartiallyFunded", baseCtx);
    expect(result.ok).toBe(false);
    expect(result.validOutbound).not.toContain("PartiallyFunded");
  });

  it("allows PendingFunding -> PartiallyFunded once a partial deposit is confirmed", () => {
    const ctx = { ...baseCtx, cumulativeConfirmedDeposits: 300 };
    const result = canEscrowTransition("PendingFunding", "PartiallyFunded", ctx);
    expect(result.ok).toBe(true);
    expect(result.validOutbound).toContain("PartiallyFunded");
  });

  it("blocks PartiallyFunded -> FullyFunded while below the funding target", () => {
    const ctx = { ...baseCtx, cumulativeConfirmedDeposits: 500 };
    const result = canEscrowTransition("PartiallyFunded", "FullyFunded", ctx);
    expect(result.ok).toBe(false);
  });

  it("allows PartiallyFunded -> FullyFunded once cumulative deposits meet the target", () => {
    const ctx = { ...baseCtx, cumulativeConfirmedDeposits: 1000 };
    const result = canEscrowTransition("PartiallyFunded", "FullyFunded", ctx);
    expect(result.ok).toBe(true);
  });

  it("allows PendingFunding -> FullyFunded directly when the first deposit already meets the target", () => {
    const ctx = { ...baseCtx, cumulativeConfirmedDeposits: 1500 };
    const result = canEscrowTransition("PendingFunding", "FullyFunded", ctx);
    expect(result.ok).toBe(true);
  });

  it("blocks automated transitions while the escrow is flagged inconsistent", () => {
    const ctx: EscrowContext = {
      ...baseCtx,
      cumulativeConfirmedDeposits: 1000,
      onChainBalance: 900,
      expectedBalance: 1000,
      inconsistent: true,
      isAutomated: true,
    };
    const result = canEscrowTransition("FullyFunded", "Locked", ctx);
    expect(result.ok).toBe(false);
    expect(result.unmetPreconditions.join(" ")).toContain("inconsistent");
  });

  it("allows the automated FullyFunded -> Locked transition once reconciled", () => {
    const ctx: EscrowContext = {
      ...baseCtx,
      cumulativeConfirmedDeposits: 1000,
      onChainBalance: 1000,
      expectedBalance: 1000,
      inconsistent: false,
      isAutomated: true,
    };
    const result = canEscrowTransition("FullyFunded", "Locked", ctx);
    expect(result.ok).toBe(true);
  });

  it("still allows a manual, actor-initiated Cancelled transition while inconsistent", () => {
    const ctx: EscrowContext = {
      ...baseCtx,
      inconsistent: true,
      isAutomated: false,
      actorRole: "Organizer",
    };
    const result = canEscrowTransition("FullyFunded", "Cancelled", ctx);
    expect(result.ok).toBe(true);
  });

  it("rejects a transition not present in the map", () => {
    const result = canEscrowTransition("PendingFunding", "Released", baseCtx);
    expect(result.ok).toBe(false);
    expect(result.unmetPreconditions[0]).toContain("no transition from PendingFunding to Released");
  });

  it("marks Released and Refunded as terminal", () => {
    expect(isEscrowTerminal("Released")).toBe(true);
    expect(isEscrowTerminal("Refunded")).toBe(true);
    expect(isEscrowTerminal("PendingFunding")).toBe(false);
    expect(validEscrowOutboundStates("Released", baseCtx)).toEqual([]);
    expect(validEscrowOutboundStates("Refunded", baseCtx)).toEqual([]);
  });
});
