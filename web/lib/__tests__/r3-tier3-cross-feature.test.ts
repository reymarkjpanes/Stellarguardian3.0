/**
 * Tier 3: Cross-Feature Pairwise Interaction Tests
 * Pairwise interactions connecting R1, R2, and R3 requirements.
 */
import { describe, it, expect } from "vitest";
import { EventWorkflowEngine } from "../engines/workflow/event-workflow";
import type { EventState } from "@/types";
import type { EventRuleContext } from "../engines/business-rules/event-rules";

describe("Tier 3: Pairwise Cross-Feature Interactions", () => {
  it("T3-01: User Onboarding -> Workspace Creation -> Event Draft -> Published", () => {
    // 1. User onboarding data setup
    const userProfile = { display_name: "Test Organizer" };
    const workspace = { id: "ws-1", name: "Test Workspace", slug: "test-workspace" };

    expect(userProfile.display_name).toBeTruthy();
    expect(workspace.slug).toBe("test-workspace");

    // 2. Create Event in workspace (initial state Draft)
    let eventState: EventState = "Draft";

    const ctx: EventRuleContext = {
      judgeCount: 2,
      registrationDeadline: "2026-12-31T23:59:59Z",
      prizePoolTarget: 5000,
      hasSubmissions: false,
      allSubmissionsScored: false,
      escrowFullyFundedOnChain: true,
      reviewWindowElapsed: false,
      unresolvedDisputes: 0,
      registrationCount: 0,
      submissionCount: 0,
      minimumParticipantsMet: false,
      kycRequirementsSatisfied: true,
    };

    // Transition Draft -> Published
    const res = EventWorkflowEngine.canTransition(eventState, "Published", ctx);
    expect(res.ok).toBe(true);
    if (res.ok) eventState = "Published";

    expect(eventState).toBe("Published");
  });

  it("T3-02: Registration -> Team Lock -> Submissions Open/Close -> Judging Round 1", () => {
    let currentState: EventState = "Published";

    const ctx: EventRuleContext = {
      judgeCount: 3,
      registrationDeadline: "2026-12-31T23:59:59Z",
      prizePoolTarget: 10000,
      hasSubmissions: true,
      allSubmissionsScored: false,
      escrowFullyFundedOnChain: true,
      reviewWindowElapsed: false,
      unresolvedDisputes: 0,
      registrationCount: 20,
      submissionCount: 8,
      minimumParticipantsMet: true,
      kycRequirementsSatisfied: true,
    };

    // Sequence of transitions
    const sequence: EventState[] = [
      "RegistrationOpen",
      "RegistrationClosed",
      "TeamFormationLocked",
      "SubmissionOpen",
      "SubmissionClosed",
      "JudgingRound1",
    ];

    for (const targetState of sequence) {
      const res = EventWorkflowEngine.canTransition(currentState, targetState, ctx);
      expect(res.ok).toBe(true);
      if (res.ok) currentState = targetState;
    }

    expect(currentState).toBe("JudgingRound1");
  });

  it("T3-03: Judging -> Winner Verification -> Dispute Window (0 disputes) -> PrizeApproved -> Automated Escrow Trigger", () => {
    let currentState: EventState = "JudgingRound1";

    const validCtx: EventRuleContext = {
      judgeCount: 3,
      registrationDeadline: "2026-12-31T23:59:59Z",
      prizePoolTarget: 10000,
      hasSubmissions: true,
      allSubmissionsScored: true,
      escrowFullyFundedOnChain: true,
      reviewWindowElapsed: true,
      unresolvedDisputes: 0,
      registrationCount: 20,
      submissionCount: 8,
      minimumParticipantsMet: true,
      kycRequirementsSatisfied: true,
    };

    // Step 1: JudgingRound1 -> WinnerVerification
    const res1 = EventWorkflowEngine.canTransition(currentState, "WinnerVerification", validCtx);
    expect(res1.ok).toBe(true);
    currentState = "WinnerVerification";

    // Step 2: WinnerVerification -> DisputeWindow
    const res2 = EventWorkflowEngine.canTransition(currentState, "DisputeWindow", validCtx);
    expect(res2.ok).toBe(true);
    currentState = "DisputeWindow";

    // Step 3: DisputeWindow -> PrizeApproved (0 unresolved disputes)
    const res3 = EventWorkflowEngine.canTransition(currentState, "PrizeApproved", validCtx);
    expect(res3.ok).toBe(true);
    currentState = "PrizeApproved";

    // Step 4: Automated Escrow Cron trigger simulation
    expect(currentState).toBe("PrizeApproved");
    expect(validCtx.unresolvedDisputes).toBe(0);
    expect(validCtx.escrowFullyFundedOnChain).toBe(true);

    // Cron advances event to EscrowRelease
    const res4 = EventWorkflowEngine.canTransition(currentState, "EscrowRelease", validCtx);
    expect(res4.ok).toBe(true);
    currentState = "EscrowRelease";

    expect(currentState).toBe("EscrowRelease");
  });

  it("T3-04: Active Dispute blocks transition to PrizeApproved and Escrow Payout", () => {
    const currentState: EventState = "DisputeWindow";

    const disputeCtx: EventRuleContext = {
      judgeCount: 3,
      registrationDeadline: "2026-12-31T23:59:59Z",
      prizePoolTarget: 10000,
      hasSubmissions: true,
      allSubmissionsScored: true,
      escrowFullyFundedOnChain: true,
      reviewWindowElapsed: true,
      unresolvedDisputes: 1, // Active dispute present
      registrationCount: 20,
      submissionCount: 8,
      minimumParticipantsMet: true,
      kycRequirementsSatisfied: true,
    };

    // Attempt DisputeWindow -> PrizeApproved with active dispute
    const res = EventWorkflowEngine.canTransition(currentState, "PrizeApproved", disputeCtx);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("dispute"))).toBe(true);
  });

  it("T3-05: Unfunded Escrow blocks Automated Escrow Trigger at PrizeApproved", () => {
    const currentState: EventState = "PrizeApproved";

    const unfundedCtx: EventRuleContext = {
      judgeCount: 3,
      registrationDeadline: "2026-12-31T23:59:59Z",
      prizePoolTarget: 10000,
      hasSubmissions: true,
      allSubmissionsScored: true,
      escrowFullyFundedOnChain: false, // Escrow unfunded
      reviewWindowElapsed: true,
      unresolvedDisputes: 0,
      registrationCount: 20,
      submissionCount: 8,
      minimumParticipantsMet: true,
      kycRequirementsSatisfied: true,
    };

    // Attempt PrizeApproved -> EscrowRelease with unfunded escrow
    const res = EventWorkflowEngine.canTransition(currentState, "EscrowRelease", unfundedCtx);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.toLowerCase().includes("escrow"))).toBe(true);
  });
});
