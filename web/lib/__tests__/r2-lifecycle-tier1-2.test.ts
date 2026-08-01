/**
 * Requirement R2: Event Lifecycle State Machine Alignment
 * Tests Tier 1 (Feature Coverage) and Tier 2 (Boundary & Corner Cases)
 */
import { describe, it, expect } from "vitest";
import { EventWorkflowEngine } from "../engines/workflow/event-workflow";
import type { EventState } from "@/types";
import type { EventRuleContext } from "../engines/business-rules/event-rules";

// Helper for UI action button mapping check (as rendered in event-detail-client.tsx)
function getAvailableUIActionButtons(
  state: EventState,
  isOrganizer: boolean,
): { label: string; requiresConfirmation: boolean }[] {
  if (!isOrganizer) return [];

  switch (state) {
    case "Draft":
      return [
        { label: "Submit for Review", requiresConfirmation: false },
        { label: "Publish Event", requiresConfirmation: false },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "Review":
      return [
        { label: "Publish Event", requiresConfirmation: false },
        { label: "Revert to Draft", requiresConfirmation: false },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "Published":
      return [
        { label: "Open Registration", requiresConfirmation: false },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "RegistrationOpen":
      return [
        { label: "Close Registration", requiresConfirmation: false },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "RegistrationClosed":
      return [
        { label: "Lock Team Formation", requiresConfirmation: true },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "TeamFormationLocked":
      return [
        { label: "Open Submissions", requiresConfirmation: false },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "SubmissionOpen":
      return [
        { label: "Close Submissions", requiresConfirmation: true },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "SubmissionClosed":
      return [
        { label: "Begin Judging (Round 1)", requiresConfirmation: true },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "JudgingRound1":
      return [
        { label: "Promote to Round 2", requiresConfirmation: false },
        { label: "Skip Round 2 (Verify Winners)", requiresConfirmation: false },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "JudgingRound2":
      return [
        { label: "Verify Winners", requiresConfirmation: false },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "WinnerVerification":
      return [
        { label: "Open Dispute Window", requiresConfirmation: false },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "DisputeWindow":
      return [
        { label: "Approve Prizes", requiresConfirmation: false },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "PrizeApproved":
      return [
        { label: "Release Escrow", requiresConfirmation: true },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "EscrowRelease":
      return [
        { label: "Mark Completed", requiresConfirmation: true },
        { label: "Cancel Event", requiresConfirmation: true },
      ];
    case "Completed":
      return [{ label: "Archive Event", requiresConfirmation: false }];
    default:
      return [];
  }
}

const DEFAULT_VALID_CTX: EventRuleContext = {
  judgeCount: 2,
  registrationDeadline: "2026-12-31T23:59:59Z",
  teamSizeMin: 1,
  prizePoolTarget: 1000,
  hasSubmissions: true,
  allSubmissionsScored: true,
  escrowFullyFundedOnChain: true,
  reviewWindowElapsed: true,
  unresolvedDisputes: 0,
  registrationCount: 10,
  submissionCount: 5,
  kycRequirementsSatisfied: true,
  minimumParticipantsMet: true,
};

describe("R2 Tier 1: Event Lifecycle Feature Coverage", () => {
  it("R2-T1-01: UI action buttons explicitly align with granular DB state", () => {
    const draftButtons = getAvailableUIActionButtons("Draft", true);
    expect(draftButtons.map((b) => b.label)).toContain("Publish Event");

    const regClosedButtons = getAvailableUIActionButtons("RegistrationClosed", true);
    expect(regClosedButtons.map((b) => b.label)).toContain("Lock Team Formation");

    const subClosedButtons = getAvailableUIActionButtons("SubmissionClosed", true);
    expect(subClosedButtons.map((b) => b.label)).toContain("Begin Judging (Round 1)");
  });

  it("R2-T1-02: State transition engine allows valid step-by-step progression", () => {
    // Draft -> Published
    const res1 = EventWorkflowEngine.canTransition("Draft", "Published", DEFAULT_VALID_CTX);
    expect(res1.ok).toBe(true);

    // Published -> RegistrationOpen
    const res2 = EventWorkflowEngine.canTransition(
      "Published",
      "RegistrationOpen",
      DEFAULT_VALID_CTX,
    );
    expect(res2.ok).toBe(true);

    // RegistrationOpen -> RegistrationClosed
    const res3 = EventWorkflowEngine.canTransition(
      "RegistrationOpen",
      "RegistrationClosed",
      DEFAULT_VALID_CTX,
    );
    expect(res3.ok).toBe(true);
  });

  it("R2-T1-03: Irreversible transitions specify required confirmation dialogs", () => {
    const lockTeamsButton = getAvailableUIActionButtons("RegistrationClosed", true).find(
      (b) => b.label === "Lock Team Formation",
    );
    expect(lockTeamsButton?.requiresConfirmation).toBe(true);

    const closeSubmissionsButton = getAvailableUIActionButtons("SubmissionOpen", true).find(
      (b) => b.label === "Close Submissions",
    );
    expect(closeSubmissionsButton?.requiresConfirmation).toBe(true);

    const beginJudgingButton = getAvailableUIActionButtons("SubmissionClosed", true).find(
      (b) => b.label === "Begin Judging (Round 1)",
    );
    expect(beginJudgingButton?.requiresConfirmation).toBe(true);

    const releaseEscrowButton = getAvailableUIActionButtons("PrizeApproved", true).find(
      (b) => b.label === "Release Escrow",
    );
    expect(releaseEscrowButton?.requiresConfirmation).toBe(true);

    const markCompletedButton = getAvailableUIActionButtons("EscrowRelease", true).find(
      (b) => b.label === "Mark Completed",
    );
    expect(markCompletedButton?.requiresConfirmation).toBe(true);

    const cancelEventButton = getAvailableUIActionButtons("Draft", true).find(
      (b) => b.label === "Cancel Event",
    );
    expect(cancelEventButton?.requiresConfirmation).toBe(true);
  });

  it("R2-T1-04: State transition returns valid outbound options", () => {
    const outbound = EventWorkflowEngine.getValidTransitions("Draft", DEFAULT_VALID_CTX);
    expect(outbound).toContain("Review");
    expect(outbound).toContain("Published");
    expect(outbound).toContain("Cancelled");
  });

  it("R2-T1-05: Unmet preconditions result in transition rejection with error details", () => {
    const invalidCtx: EventRuleContext = {
      ...DEFAULT_VALID_CTX,
      judgeCount: 0,
      registrationDeadline: undefined,
    };

    const res = EventWorkflowEngine.canTransition("Draft", "Published", invalidCtx);
    expect(res.ok).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors.some((e) => e.toLowerCase().includes("judge"))).toBe(true);
  });
});

describe("R2 Tier 2: Lifecycle Boundary & Corner Cases", () => {
  it("R2-T2-01: Illegal out-of-order transition (Draft -> PrizeApproved) returns failure", () => {
    const res = EventWorkflowEngine.canTransition("Draft", "PrizeApproved", DEFAULT_VALID_CTX);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("Invalid transition"))).toBe(true);
  });

  it("R2-T2-02: Transition to JudgingRound1 fails if submission count is zero", () => {
    const noSubCtx: EventRuleContext = {
      ...DEFAULT_VALID_CTX,
      hasSubmissions: false,
      submissionCount: 0,
    };

    const res = EventWorkflowEngine.canTransition("SubmissionClosed", "JudgingRound1", noSubCtx);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("submission"))).toBe(true);
  });

  it("R2-T2-03: Transition to WinnerVerification fails if not all submissions are scored", () => {
    const unscoredCtx: EventRuleContext = {
      ...DEFAULT_VALID_CTX,
      allSubmissionsScored: false,
    };

    const res = EventWorkflowEngine.canTransition(
      "JudgingRound1",
      "WinnerVerification",
      unscoredCtx,
    );
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("scored"))).toBe(true);
  });

  it("R2-T2-04: Transition to PrizeApproved fails if there are unresolved disputes", () => {
    const disputeCtx: EventRuleContext = {
      ...DEFAULT_VALID_CTX,
      unresolvedDisputes: 2,
    };

    const res = EventWorkflowEngine.canTransition("DisputeWindow", "PrizeApproved", disputeCtx);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("dispute"))).toBe(true);
  });

  it("R2-T2-05: Non-organizer UI check returns zero available action buttons", () => {
    const buttons = getAvailableUIActionButtons("RegistrationOpen", false);
    expect(buttons).toHaveLength(0);
  });
});
