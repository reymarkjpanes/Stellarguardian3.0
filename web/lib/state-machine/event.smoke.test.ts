/**
 * Smoke checks for the event lifecycle state machine (task 4.1).
 *
 * These are NOT the dedicated property tests (those are separate tasks
 * 4.2/4.3) — just enough coverage to confirm the module compiles correctly
 * and behaves sanely before the property tests are written.
 */
import { describe, expect, it } from "vitest";
import { canTransition, isTerminal, validOutboundStates, TERMINAL_STATES } from "./event";
import type { TransitionContext } from "./event";

const baseCtx: TransitionContext = {
  judgeCount: 0,
  registrationDeadline: undefined,
  teamSizeMin: undefined,
  hasSubmissions: false,
  allSubmissionsScored: false,
  escrowFullyFundedOnChain: false,
  reviewWindowElapsed: false,
  unresolvedDisputes: 0,
  registrationCount: 0,
  submissionCount: 0,
  actorRole: "Organizer",
};

describe("event state machine smoke checks", () => {
  it("blocks Draft -> Published without a judge assigned", () => {
    const result = canTransition("Draft", "Published", baseCtx);
    expect(result.ok).toBe(false);
    expect(result.unmetPreconditions).toContain(
      "Published requires at least one judge assigned (Req 23.3)",
    );
    expect(result.validOutbound).not.toContain("Published");
  });

  it("allows Draft -> Published once a judge is assigned", () => {
    const result = canTransition("Draft", "Published", { ...baseCtx, judgeCount: 1 });
    expect(result.ok).toBe(true);
    expect(result.validOutbound).toContain("Published");
  });

  it("rejects a transition not present in the map", () => {
    const result = canTransition("Draft", "Judging", baseCtx);
    expect(result.ok).toBe(false);
    expect(result.unmetPreconditions[0]).toContain("no transition from Draft to Judging");
  });

  it("allows Cancelled from any non-terminal state", () => {
    for (const state of [
      "Draft",
      "Published",
      "RegistrationOpen",
      "RegistrationClosed",
      "TeamFormation",
      "SubmissionOpen",
      "SubmissionClosed",
      "Judging",
      "ReviewObjectionWindow",
      "WinnersFinalized",
      "OrganizerFundsEscrow",
      "EscrowLocked",
      "PrizeDistribution",
    ] as const) {
      const result = canTransition(state, "Cancelled", baseCtx);
      expect(result.ok).toBe(true);
    }
  });

  it("blocks outbound transitions from terminal states except Completed -> Archived", () => {
    expect(canTransition("Cancelled", "Archived", baseCtx).ok).toBe(false);
    expect(canTransition("Archived", "Completed", baseCtx).ok).toBe(false);
    expect(canTransition("Completed", "Archived", baseCtx).ok).toBe(true);
    expect(validOutboundStates("Cancelled", baseCtx)).toEqual([]);
    expect(validOutboundStates("Archived", baseCtx)).toEqual([]);
    expect(validOutboundStates("Completed", baseCtx)).toEqual(["Archived"]);
  });

  it("gates rollback transitions on their guards", () => {
    // Published -> Draft is always permitted.
    expect(canTransition("Published", "Draft", baseCtx).ok).toBe(true);

    // RegistrationOpen -> Published only if zero registrations exist.
    expect(
      canTransition("RegistrationOpen", "Published", { ...baseCtx, registrationCount: 0 }).ok,
    ).toBe(true);
    expect(
      canTransition("RegistrationOpen", "Published", { ...baseCtx, registrationCount: 1 }).ok,
    ).toBe(false);

    // SubmissionOpen -> TeamFormation only if zero submissions exist.
    expect(
      canTransition("SubmissionOpen", "TeamFormation", { ...baseCtx, submissionCount: 0 }).ok,
    ).toBe(true);
    expect(
      canTransition("SubmissionOpen", "TeamFormation", { ...baseCtx, submissionCount: 1 }).ok,
    ).toBe(false);
  });

  it("blocks PrizeDistribution while disputes are unresolved or the review window has not elapsed", () => {
    const ready = { ...baseCtx, reviewWindowElapsed: true, unresolvedDisputes: 0 };
    expect(canTransition("EscrowLocked", "PrizeDistribution", ready).ok).toBe(true);
    expect(
      canTransition("EscrowLocked", "PrizeDistribution", { ...ready, unresolvedDisputes: 1 }).ok,
    ).toBe(false);
    expect(
      canTransition("EscrowLocked", "PrizeDistribution", { ...ready, reviewWindowElapsed: false })
        .ok,
    ).toBe(false);
  });

  it("isTerminal matches TERMINAL_STATES membership", () => {
    for (const state of ["Completed", "Cancelled", "Archived"] as const) {
      expect(isTerminal(state)).toBe(true);
      expect(TERMINAL_STATES.has(state)).toBe(true);
    }
    expect(isTerminal("Draft")).toBe(false);
  });
});
