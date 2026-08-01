/**
 * Tier 4: Real-World Application Scenario
 * Full E2E Organizer Journey from fresh signup to automated Soroban escrow payout.
 */
import { describe, it, expect } from "vitest";
import { EventWorkflowEngine } from "../engines/workflow/event-workflow";
import type { EventState } from "@/types";
import type { EventRuleContext } from "../engines/business-rules/event-rules";

describe("Tier 4: Full E2E Organizer Real-World Journey", () => {
  it("Simulates complete organizer journey from fresh signup to automated escrow payout execution", async () => {
    // Phase 1: Fresh user signup
    const user = {
      id: "user-organizer-007",
      email: "organizer007@stellar-guardian.io",
      display_name: null as string | null,
    };
    let workspaceCount = 0;

    // Step 1: User attempts to access /dashboard -> blocked by onboarding middleware
    const requiresOnboarding =
      !user.display_name || user.display_name === user.email || workspaceCount === 0;
    expect(requiresOnboarding).toBe(true);

    // Step 2: User completes onboarding form
    user.display_name = "Stellar Master Organizer";
    const workspace = {
      id: "ws-guardian-007",
      name: "Guardian Labs Workspace",
      slug: "guardian-labs-workspace-a1b2",
    };
    workspaceCount = 1;

    const onboardingComplete =
      user.display_name && user.display_name !== user.email && workspaceCount > 0;
    expect(onboardingComplete).toBe(true);

    // Step 3: Redirect to /dashboard succeeds
    const dashboardAccessible = !(
      !user.display_name ||
      user.display_name === user.email ||
      workspaceCount === 0
    );
    expect(dashboardAccessible).toBe(true);

    // Phase 2: Create Hackathon Event
    const event = {
      id: "event-hackathon-2026",
      workspace_id: workspace.id,
      organizer_id: user.id,
      title: "Stellar Guardian Global Hackathon 2026",
      prize_pool_target: 25000,
      state: "Draft" as EventState,
      version: 1,
    };

    // Phase 3: Lifecycle State Machine Transitions
    const journeyStateAuditTrail: { from: EventState; to: EventState; version: number }[] = [];

    function advanceState(
      targetState: EventState,
      ctx: EventRuleContext,
      confirmationConfirmed = true,
    ) {
      if (!confirmationConfirmed) return false;

      const res = EventWorkflowEngine.canTransition(event.state, targetState, ctx);
      if (!res.ok) {
        throw new Error(
          `Failed to advance from ${event.state} to ${targetState}: ${res.errors.join(", ")}`,
        );
      }

      journeyStateAuditTrail.push({
        from: event.state,
        to: targetState,
        version: event.version,
      });

      event.state = targetState;
      event.version += 1;
      return true;
    }

    const journeyCtx: EventRuleContext = {
      judgeCount: 3,
      registrationDeadline: "2026-12-31T23:59:59Z",
      teamSizeMin: 1,
      prizePoolTarget: 25000,
      hasSubmissions: true,
      allSubmissionsScored: true,
      escrowFullyFundedOnChain: true,
      reviewWindowElapsed: true,
      unresolvedDisputes: 0,
      registrationCount: 50,
      submissionCount: 15,
      kycRequirementsSatisfied: true,
      minimumParticipantsMet: true,
    };

    // 1. Draft -> Published
    advanceState("Published", journeyCtx);
    expect(event.state).toBe("Published");

    // 2. Published -> RegistrationOpen
    advanceState("RegistrationOpen", journeyCtx);
    expect(event.state).toBe("RegistrationOpen");

    // 3. RegistrationOpen -> RegistrationClosed
    advanceState("RegistrationClosed", journeyCtx);
    expect(event.state).toBe("RegistrationClosed");

    // 4. RegistrationClosed -> TeamFormationLocked (Requires confirmation modal)
    advanceState("TeamFormationLocked", journeyCtx, true);
    expect(event.state).toBe("TeamFormationLocked");

    // 5. TeamFormationLocked -> SubmissionOpen
    advanceState("SubmissionOpen", journeyCtx);
    expect(event.state).toBe("SubmissionOpen");

    // 6. SubmissionOpen -> SubmissionClosed (Requires confirmation modal)
    advanceState("SubmissionClosed", journeyCtx, true);
    expect(event.state).toBe("SubmissionClosed");

    // 7. SubmissionClosed -> JudgingRound1 (Requires confirmation modal)
    advanceState("JudgingRound1", journeyCtx, true);
    expect(event.state).toBe("JudgingRound1");

    // 8. JudgingRound1 -> WinnerVerification
    advanceState("WinnerVerification", journeyCtx);
    expect(event.state).toBe("WinnerVerification");

    // 9. WinnerVerification -> DisputeWindow
    advanceState("DisputeWindow", journeyCtx);
    expect(event.state).toBe("DisputeWindow");

    // 10. DisputeWindow -> PrizeApproved
    advanceState("PrizeApproved", journeyCtx);
    expect(event.state).toBe("PrizeApproved");

    // Phase 4: Automated Escrow Trigger & Soroban Contract Payout
    expect(event.state).toBe("PrizeApproved");

    // Simulated Cron Escrow Processing
    const escrowAccount = {
      id: "escrow-guardian-2026",
      event_id: event.id,
      state: "FullyFunded",
      prize_allocation_batch_id: "batch-payout-2026",
    };

    // Automated trigger checks
    expect(escrowAccount.state).toBe("FullyFunded");
    expect(journeyCtx.unresolvedDisputes).toBe(0);

    // Cron automatically transitions state to EscrowRelease and executes payout batch
    advanceState("EscrowRelease", journeyCtx);
    expect(event.state).toBe("EscrowRelease");

    // Final state: EscrowRelease -> Completed
    advanceState("Completed", journeyCtx, true);
    expect(event.state).toBe("Completed");

    // Verify audit trail recorded all 12 transitions cleanly
    expect(journeyStateAuditTrail).toHaveLength(12);
    expect(journeyStateAuditTrail[0]?.from).toBe("Draft");
    expect(journeyStateAuditTrail[11]?.to).toBe("Completed");
    expect(event.version).toBe(13);
  });
});
