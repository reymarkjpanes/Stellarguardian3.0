/**
 * Event state machine tests (Task 0.3, Task 5 — state machine coverage).
 *
 * Verifies: valid transitions, precondition enforcement, terminal state edges,
 * and that Cancelled/Archived have the right outbound edges.
 */
import { describe, it, expect } from "vitest";
import {
  canEventTransition,
  validEventOutboundStates,
  isEventTerminal,
  EVENT_TERMINAL,
  type EventTransitionContext,
} from "./event";
import type { EventState } from "@/types";

const ORGANIZER_CTX: EventTransitionContext = {
  actorRole: "Organizer",
};

const ADMIN_CTX: EventTransitionContext = {
  actorRole: "PlatformAdmin",
};

const FULL_CTX: EventTransitionContext = {
  actorRole: "Organizer",
  judgeCount: 2,
  hasRegistrationDeadline: true,
  allParticipantsAssigned: true,
  teamSizeMet: true,
  hasSubmissions: true,
  allSubmissionsScored: true,
  reviewWindowElapsed: true,
  unresolvedDisputes: 0,
  winnersConfirmed: true,
  escrowFullyFunded: true,
  escrowLocked: true,
  allDisbursementsComplete: true,
};

// ── Basic graph shape ────────────────────────────────────────────────────────
describe("canEventTransition — basic valid paths", () => {
  it("Draft → Published when preconditions met", () => {
    const result = canEventTransition("Draft", "Published", {
      actorRole: "Organizer",
      judgeCount: 1,
      hasRegistrationDeadline: true,
    });
    expect(result.ok).toBe(true);
  });

  it("Draft → Published fails without judges", () => {
    const result = canEventTransition("Draft", "Published", {
      actorRole: "Organizer",
      judgeCount: 0,
      hasRegistrationDeadline: true,
    });
    expect(result.ok).toBe(false);
    expect(result.unmetPreconditions.some((p) => p.includes("judge"))).toBe(true);
  });

  it("Draft → Published fails without registration deadline", () => {
    const result = canEventTransition("Draft", "Published", {
      actorRole: "Organizer",
      judgeCount: 1,
      hasRegistrationDeadline: false,
    });
    expect(result.ok).toBe(false);
  });

  it("Published → RegistrationOpen (organizer)", () => {
    expect(canEventTransition("Published", "RegistrationOpen", ORGANIZER_CTX).ok).toBe(true);
  });

  it("RegistrationOpen → RegistrationClosed (organizer)", () => {
    expect(canEventTransition("RegistrationOpen", "RegistrationClosed", ORGANIZER_CTX).ok).toBe(
      true,
    );
  });

  it("SubmissionClosed → JudgingRound1 requires hasSubmissions", () => {
    const noSubs = canEventTransition("SubmissionClosed", "JudgingRound1", {
      actorRole: "Organizer",
      hasSubmissions: false,
    });
    expect(noSubs.ok).toBe(false);

    const withSubs = canEventTransition("SubmissionClosed", "JudgingRound1", {
      actorRole: "Organizer",
      hasSubmissions: true,
    });
    expect(withSubs.ok).toBe(true);
  });

  it("DisputeWindow → PrizeApproved requires elapsed window + zero disputes", () => {
    const pending = canEventTransition("DisputeWindow", "PrizeApproved", {
      reviewWindowElapsed: false,
      unresolvedDisputes: 0,
    });
    expect(pending.ok).toBe(false);

    const withDisputes = canEventTransition("DisputeWindow", "PrizeApproved", {
      reviewWindowElapsed: true,
      unresolvedDisputes: 2,
    });
    expect(withDisputes.ok).toBe(false);

    const clear = canEventTransition("DisputeWindow", "PrizeApproved", {
      reviewWindowElapsed: true,
      unresolvedDisputes: 0,
    });
    expect(clear.ok).toBe(true);
  });

  it("PrizeApproved → EscrowRelease requires funded + locked escrow", () => {
    const result = canEventTransition("PrizeApproved", "EscrowRelease", {
      escrowFullyFunded: true,
      escrowLocked: true,
    });
    expect(result.ok).toBe(true);
  });

  it("EscrowRelease → Completed requires allDisbursementsComplete", () => {
    expect(
      canEventTransition("EscrowRelease", "Completed", { allDisbursementsComplete: false }).ok,
    ).toBe(false);
    expect(
      canEventTransition("EscrowRelease", "Completed", { allDisbursementsComplete: true }).ok,
    ).toBe(true);
  });
});

// ── Terminal states ──────────────────────────────────────────────────────────
describe("Terminal states", () => {
  it("Completed is terminal (only → Archived)", () => {
    const outbound = validEventOutboundStates("Completed", ADMIN_CTX);
    expect(outbound).toContain("Archived");
  });

  it("Archived has no outbound edges", () => {
    expect(validEventOutboundStates("Archived", ADMIN_CTX)).toHaveLength(0);
    expect(isEventTerminal("Archived")).toBe(true);
  });

  it("Completed is terminal", () => {
    expect(isEventTerminal("Completed")).toBe(true);
  });

  it("Draft is not terminal", () => {
    expect(isEventTerminal("Draft")).toBe(false);
  });
});

// ── Cancellation ─────────────────────────────────────────────────────────────
describe("Cancellation", () => {
  const cancelStates = [
    "Draft",
    "Published",
    "RegistrationOpen",
    "RegistrationClosed",
    "TeamFormationLocked",
    "SubmissionOpen",
    "SubmissionClosed",
    "JudgingRound1",
    "JudgingRound2",
    "WinnerVerification",
    "DisputeWindow",
    "PrizeApproved",
    "EscrowRelease",
  ] as const;

  cancelStates.forEach((state) => {
    it(`${state} → Cancelled allowed by admin`, () => {
      expect(canEventTransition(state, "Cancelled", ADMIN_CTX).ok).toBe(true);
    });
  });

  it("Cancelled → Archived allowed by admin", () => {
    expect(canEventTransition("Cancelled", "Archived", ADMIN_CTX).ok).toBe(true);
  });
});

// ── Non-existent edges ───────────────────────────────────────────────────────
describe("Non-existent transitions", () => {
  it("Draft → Completed is not a valid edge", () => {
    const result = canEventTransition("Draft", "Completed", FULL_CTX);
    expect(result.ok).toBe(false);
    expect(result.unmetPreconditions.some((p) => p.includes("no transition"))).toBe(true);
  });

  it("Completed → Draft is not a valid edge", () => {
    expect(canEventTransition("Completed", "Draft", FULL_CTX).ok).toBe(false);
  });
});

// ── Role check ───────────────────────────────────────────────────────────────
describe("Role enforcement", () => {
  it("Participant cannot trigger state transitions", () => {
    const result = canEventTransition("Draft", "Published", {
      actorRole: "Participant",
      judgeCount: 2,
      hasRegistrationDeadline: true,
    });
    expect(result.ok).toBe(false);
    expect(result.unmetPreconditions.some((p) => p.includes("organizer"))).toBe(true);
  });

  it("WorkspaceOwner can publish an event", () => {
    expect(
      canEventTransition("Draft", "Published", {
        actorRole: "WorkspaceOwner",
        judgeCount: 1,
        hasRegistrationDeadline: true,
      }).ok,
    ).toBe(true);
  });
});
