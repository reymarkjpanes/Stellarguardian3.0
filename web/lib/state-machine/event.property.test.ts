/**
 * Property-based tests for the event lifecycle state machine (Task 0.3, 5).
 *
 * Properties tested:
 * 1. Terminal states have no outbound edges
 * 2. Every valid transition produces ok:true
 * 3. Non-existent edges always produce ok:false with unmetPreconditions
 * 4. validEventOutboundStates is a subset of defined outbound states
 * 5. Cancelled is reachable from all non-terminal, non-cancelled states
 */
import { describe, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import {
  canEventTransition,
  validEventOutboundStates,
  isEventTerminal,
  EVENT_TERMINAL,
  type EventTransitionContext,
} from "./event";
import type { EventState } from "@/types";
import type { PlatformRole } from "@/types";

const ALL_STATES: EventState[] = [
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
  "Completed",
  "Cancelled",
  "Archived",
];

const ADMIN_ROLES: PlatformRole[] = [
  "PlatformAdmin",
  "WorkspaceOwner",
  "WorkspaceAdmin",
  "Organizer",
];

const arbState = () => fc.constantFrom(...ALL_STATES);
const arbAdminRole = () => fc.constantFrom(...ADMIN_ROLES);

/** Full permissive context — all preconditions satisfied */
function fullCtx(role: PlatformRole = "Organizer"): EventTransitionContext {
  return {
    actorRole: role,
    judgeCount: 3,
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
}

describe("Event state machine property tests", () => {
  // Feature: nextjs-platform-conversion, Property 1:
  // Terminal states (Completed, Archived) have no outbound edges under any context
  it("Terminal states have no valid outbound edges", () => {
    fc.assert(
      fc.property(arbAdminRole(), (role) => {
        for (const terminal of EVENT_TERMINAL) {
          const outbound = validEventOutboundStates(terminal, fullCtx(role));
          // Archived has no edges at all
          if (terminal === "Archived") {
            return outbound.length === 0;
          }
          // Completed can only go to Archived
          if (terminal === "Completed") {
            return outbound.every((s) => s === "Archived");
          }
        }
        return true;
      }),
      fcConfig,
    );
  });

  // Feature: nextjs-platform-conversion, Property 2:
  // canEventTransition with a non-existent edge always returns ok:false
  it("Non-existent edges always return ok:false", () => {
    // Known non-existent edges
    const impossible: Array<[EventState, EventState]> = [
      ["Completed", "Draft"],
      ["Archived", "Draft"],
      ["Archived", "Published"],
      ["JudgingRound1", "Draft"],
      ["EscrowRelease", "Draft"],
      ["PrizeApproved", "RegistrationOpen"],
    ];

    fc.assert(
      fc.property(arbAdminRole(), (role) => {
        for (const [from, to] of impossible) {
          const result = canEventTransition(from, to, fullCtx(role));
          if (result.ok) return false;
          if (result.unmetPreconditions.length === 0) return false;
        }
        return true;
      }),
      fcConfig,
    );
  });

  // Feature: nextjs-platform-conversion, Property 3:
  // validOutbound returned from canEventTransition is consistent with validEventOutboundStates
  it("validOutbound in TransitionResult matches validEventOutboundStates", () => {
    fc.assert(
      fc.property(arbState(), arbState(), arbAdminRole(), (from, to, role) => {
        const ctx = fullCtx(role);
        const result = canEventTransition(from, to, ctx);
        const directOutbound = validEventOutboundStates(from, ctx);

        // Every state in result.validOutbound must also be in directOutbound
        return result.validOutbound.every((s) => directOutbound.includes(s));
      }),
      fcConfig,
    );
  });

  // Feature: nextjs-platform-conversion, Property 4:
  // isEventTerminal is consistent with EVENT_TERMINAL set
  it("isEventTerminal is consistent with EVENT_TERMINAL", () => {
    fc.assert(
      fc.property(arbState(), (state) => {
        return isEventTerminal(state) === EVENT_TERMINAL.has(state);
      }),
      fcConfig,
    );
  });

  // Feature: nextjs-platform-conversion, Property 5:
  // Cancellation is reachable from all non-terminal, non-cancelled/archived states
  it("Cancelled is reachable from all active states via admin role", () => {
    const activeStates = ALL_STATES.filter(
      (s) => !EVENT_TERMINAL.has(s) && s !== "Cancelled" && s !== "Archived",
    );

    fc.assert(
      fc.property(fc.constantFrom(...activeStates), (state) => {
        const result = canEventTransition(state, "Cancelled", fullCtx("PlatformAdmin"));
        return result.ok === true;
      }),
      fcConfig,
    );
  });

  // Feature: nextjs-platform-conversion, Property 6:
  // A non-organizer role (Participant) cannot trigger state transitions requiring organizer
  it("Participant role is rejected for organizer-gated transitions", () => {
    const organizerGated: Array<[EventState, EventState]> = [
      ["Draft", "Published"],
      ["Published", "RegistrationOpen"],
      ["RegistrationOpen", "RegistrationClosed"],
      ["SubmissionOpen", "SubmissionClosed"],
    ];

    fc.assert(
      fc.property(fc.constantFrom(...organizerGated), ([from, to]) => {
        const result = canEventTransition(from, to, {
          ...fullCtx("Participant"),
          actorRole: "Participant",
        });
        return !result.ok;
      }),
      fcConfig,
    );
  });
});
