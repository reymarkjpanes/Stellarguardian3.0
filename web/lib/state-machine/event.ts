/**
 * Event lifecycle state machine (Req 6, 23, Task 0.3).
 *
 * Pure module — no I/O. Exports `canEventTransition` over the 10 canonical
 * event states. Mirrors the shape of the escrow state machine (./escrow.ts)
 * for a consistent `TransitionResult` type.
 *
 * Each edge carries a list of precondition functions that return unmet-reason
 * strings. An empty list means the edge is currently satisfiable.
 */
import type { EventState, PlatformRole } from "@/types";

export interface TransitionResult {
  ok: boolean;
  /** Outbound states reachable from `from` with current context — for 422 payloads. */
  validOutbound: EventState[];
  /** Human-readable reasons the requested transition is not currently permitted. */
  unmetPreconditions: string[];
}

/**
 * Context driving event transition preconditions (Req 6, 23).
 * All fields are optional/boolean to allow partial context at call sites.
 */
export interface EventTransitionContext {
  /** Number of judges assigned to the event. */
  judgeCount?: number;
  /** Whether a registration deadline has been configured. */
  hasRegistrationDeadline?: boolean;
  /** Whether all participants have been assigned to teams. */
  allParticipantsAssigned?: boolean;
  /** Whether minimum team size is met for all active teams. */
  teamSizeMet?: boolean;
  /** Whether at least one submission exists. */
  hasSubmissions?: boolean;
  /** Whether all submissions have been scored by judges. */
  allSubmissionsScored?: boolean;
  /** Whether the dispute / review window has elapsed. */
  reviewWindowElapsed?: boolean;
  /** Count of unresolved (Open/UnderReview) disputes. */
  unresolvedDisputes?: number;
  /** Whether winners have been explicitly confirmed/verified. */
  winnersConfirmed?: boolean;
  /** Whether the escrow is fully funded on-chain. */
  escrowFullyFunded?: boolean;
  /** Whether the escrow has been locked (no further deposits). */
  escrowLocked?: boolean;
  /** Whether all disbursements have completed on-chain. */
  allDisbursementsComplete?: boolean;
  /** Whether the event has any funding (to determine refund obligation on cancel). */
  hasFunding?: boolean;
  /** Role of the acting user. */
  actorRole?: PlatformRole;
}

/** Roles that can trigger manual organizer-gated transitions. */
const ORGANIZER_ROLES: ReadonlySet<PlatformRole> = new Set([
  "Organizer",
  "WorkspaceOwner",
  "WorkspaceAdmin",
]);

/** Roles that can cancel or perform admin actions. */
const ADMIN_ROLES: ReadonlySet<PlatformRole> = new Set([
  "PlatformAdmin",
  "Organizer",
  "WorkspaceOwner",
  "WorkspaceAdmin",
]);

interface Edge {
  to: EventState;
  unmet(ctx: EventTransitionContext): string[];
}

function organizerCheck(ctx: EventTransitionContext): string[] {
  if (!ctx.actorRole || !ORGANIZER_ROLES.has(ctx.actorRole)) {
    return ["only the event organizer or workspace owner can perform this action (Req 6.3)"];
  }
  return [];
}

function adminCheck(ctx: EventTransitionContext): string[] {
  if (!ctx.actorRole || !ADMIN_ROLES.has(ctx.actorRole)) {
    return ["only an organizer or platform admin can perform this action (Req 6.3)"];
  }
  return [];
}

/** Terminal states — no outbound edges. */
export const EVENT_TERMINAL: ReadonlySet<EventState> = new Set(["Completed", "Archived"]);

export function isEventTerminal(state: EventState): boolean {
  return EVENT_TERMINAL.has(state);
}

const GRAPH: Record<EventState, Edge[]> = {
  Draft: [
    { to: "Review", unmet: () => [] },
    {
      to: "Published",
      unmet: (ctx) => {
        const reasons = organizerCheck(ctx);
        if ((ctx.judgeCount ?? 0) < 1) {
          reasons.push("at least one judge must be assigned before publishing (Req 6.1)");
        }
        if (!ctx.hasRegistrationDeadline) {
          reasons.push("a registration deadline must be set before publishing (Req 6.1)");
        }
        return reasons;
      },
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  Review: [
    { to: "Published", unmet: () => [] },
    { to: "Draft", unmet: () => [] },
    { to: "Cancelled", unmet: (ctx) => adminCheck(ctx) },
  ],
  Published: [
    {
      to: "RegistrationOpen",
      unmet: (ctx) => organizerCheck(ctx),
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  RegistrationOpen: [
    {
      to: "RegistrationClosed",
      unmet: (ctx) => organizerCheck(ctx),
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  RegistrationClosed: [
    {
      to: "TeamFormationLocked",
      unmet: (ctx) => organizerCheck(ctx),
    },
    {
      to: "SubmissionOpen",
      unmet: (ctx) => {
        const reasons = organizerCheck(ctx);
        if (!ctx.allParticipantsAssigned) {
          reasons.push("all registered participants must be assigned to a team (Req 6.2)");
        }
        if (!ctx.teamSizeMet) {
          reasons.push("minimum team size must be met for all active teams (Req 6.2)");
        }
        return reasons;
      },
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  TeamFormationLocked: [
    {
      to: "SubmissionOpen",
      unmet: (ctx) => organizerCheck(ctx),
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  SubmissionOpen: [
    {
      to: "SubmissionClosed",
      unmet: (ctx) => organizerCheck(ctx),
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  SubmissionClosed: [
    {
      to: "JudgingRound1",
      unmet: (ctx) => {
        const reasons = organizerCheck(ctx);
        if (!ctx.hasSubmissions) {
          reasons.push("at least one submission is required to begin judging (Req 23.4)");
        }
        return reasons;
      },
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  JudgingRound1: [
    {
      to: "JudgingRound2",
      unmet: (ctx) => {
        const reasons = organizerCheck(ctx);
        if (!ctx.allSubmissionsScored) {
          reasons.push("all submissions must be scored before proceeding (Req 23.5)");
        }
        return reasons;
      },
    },
    {
      to: "WinnerVerification",
      unmet: (ctx) => {
        const reasons = organizerCheck(ctx);
        if (!ctx.allSubmissionsScored) {
          reasons.push("all submissions must be scored before verifying winners (Req 23.5)");
        }
        return reasons;
      },
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  JudgingRound2: [
    {
      to: "WinnerVerification",
      unmet: (ctx) => {
        const reasons = organizerCheck(ctx);
        if (!ctx.allSubmissionsScored) {
          reasons.push("all submissions must be scored before verifying winners (Req 23.5)");
        }
        return reasons;
      },
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  WinnerVerification: [
    {
      to: "DisputeWindow",
      unmet: (ctx) => {
        const reasons = organizerCheck(ctx);
        if (!ctx.winnersConfirmed) {
          reasons.push("winners must be explicitly confirmed (Req 23.6)");
        }
        return reasons;
      },
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  DisputeWindow: [
    {
      to: "PrizeApproved",
      unmet: (ctx) => {
        const reasons = organizerCheck(ctx);
        if (!ctx.reviewWindowElapsed) {
          reasons.push(
            "the review/dispute window must elapse before approving prizes (Req 23.7, 39.6)",
          );
        }
        if ((ctx.unresolvedDisputes ?? 0) > 0) {
          reasons.push("all disputes must be resolved before approving prizes (Req 23.7, 39.9)");
        }
        return reasons;
      },
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  PrizeApproved: [
    {
      to: "EscrowRelease",
      unmet: (ctx) => {
        const reasons = organizerCheck(ctx);
        if (!ctx.escrowFullyFunded) {
          reasons.push("escrow must be fully funded on-chain before release (Req 26.2)");
        }
        if (!ctx.escrowLocked) {
          reasons.push("escrow must be locked before prize release begins (Req 26.3)");
        }
        return reasons;
      },
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  EscrowRelease: [
    {
      to: "Completed",
      unmet: (ctx) => {
        const reasons = organizerCheck(ctx);
        if (!ctx.allDisbursementsComplete) {
          reasons.push(
            "all prize disbursements must complete on-chain before marking complete (Req 8.7)",
          );
        }
        return reasons;
      },
    },
    {
      to: "Cancelled",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  Completed: [
    {
      to: "Archived",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  Cancelled: [
    {
      to: "Archived",
      unmet: (ctx) => adminCheck(ctx),
    },
  ],
  Suspended: [],
  Archived: [],
};

/**
 * Validates a requested event transition against the canonical transition
 * graph and its preconditions (Req 6.1-6.4, 23). Route handlers call this
 * before any database write; on failure return 422 with
 * `{ currentState, requestedState, validOutbound, unmetPreconditions }`.
 */
export function canEventTransition(
  from: EventState,
  to: EventState,
  ctx: EventTransitionContext,
): TransitionResult {
  const edges = GRAPH[from];

  const validOutbound = edges.filter((edge) => edge.unmet(ctx).length === 0).map((edge) => edge.to);

  const targetEdge = edges.find((edge) => edge.to === to);

  if (!targetEdge) {
    return {
      ok: false,
      validOutbound,
      unmetPreconditions: [
        `no transition from "${from}" to "${to}" exists in the event lifecycle (Req 23.1)`,
      ],
    };
  }

  const unmetPreconditions = targetEdge.unmet(ctx);

  return {
    ok: unmetPreconditions.length === 0,
    validOutbound,
    unmetPreconditions,
  };
}

/**
 * Returns every event state reachable from `from` given the current context.
 * Mirrors `validEscrowOutboundStates` for a consistent surface (Req 6.2).
 */
export function validEventOutboundStates(
  from: EventState,
  ctx: EventTransitionContext,
): EventState[] {
  return GRAPH[from].filter((edge) => edge.unmet(ctx).length === 0).map((edge) => edge.to);
}
