/**
 * Escrow lifecycle state machine (Req 26).
 *
 * Pure module — no I/O — exporting `canEscrowTransition` over the 9 canonical
 * escrow states. Importable by both server route handlers/services and
 * client-side UI. Mirrors the shape of the event lifecycle state machine
 * (`./event.ts`, Req 6, 23) so callers get a consistent `TransitionResult`
 * shape across both modules, but this file intentionally defines its own
 * local `TransitionResult` (rather than importing one from `./event.ts`) to
 * avoid a file-level import dependency on a sibling module being implemented
 * concurrently (Req 6.2 — single pure module per lifecycle, each independently
 * importable).
 *
 * `EscrowState` is re-exported as the same type produced by the Zod
 * `EscrowStateSchema` (Req 1.5, 26.1) defined in `/types/enums.ts` — this
 * module does not redefine the state list, it only defines the transition
 * graph and preconditions over it.
 */
import type { EscrowState, PlatformRole } from "@/types";

/**
 * Result of a requested escrow transition (mirrors the event lifecycle
 * module's `TransitionResult`, Req 23.5, for a consistent 422 payload shape
 * across all three lifecycle state machines).
 */
export interface TransitionResult {
  ok: boolean;
  /** Outbound states from `from` whose preconditions are currently met — for 422 payloads. */
  validOutbound: EscrowState[];
  /** Human-readable reasons the requested transition is not currently permitted. */
  unmetPreconditions: string[];
}

/**
 * Context driving escrow transition preconditions. Fields map directly to
 * Requirement 26 (Escrow and Funding Lifecycle) and the design's Escrow
 * Service section (Req 4, 8, 9, 26).
 */
export interface EscrowContext {
  /** Cumulative confirmed on-chain deposit amount toward this escrow (Req 26.2). */
  cumulativeConfirmedDeposits: number;
  /** Configured prize-pool funding target the escrow must reach (Req 26.2). */
  fundingTarget: number;
  /** On-chain balance observed at the most recent reconciliation check (Req 26.4, 26.5). */
  onChainBalance: number;
  /** Database-recorded expected balance compared against `onChainBalance` (Req 26.5). */
  expectedBalance: number;
  /** Whether reconciliation has already flagged this escrow `inconsistent` (Req 26.5, 26.7). */
  inconsistent: boolean;
  /**
   * True when the requested transition is Platform-automated (Locked,
   * PendingRelease, Released — Req 26.3) rather than actor-initiated. Automated
   * transitions are blocked while `inconsistent` is true (Req 26.7); manual,
   * actor-initiated transitions (e.g. Cancelled by an Organizer/Platform Admin)
   * remain possible so a stuck escrow can still be resolved.
   */
  isAutomated: boolean;
  /** Role of the acting user for actor-gated transitions (Req 26.3). Omit for automated transitions. */
  actorRole?: PlatformRole;
  /** The Review (Objection Window) has elapsed with no unresolved disputes (Req 26.3; mirrors 39.6-39.9). */
  reviewWindowElapsed: boolean;
  /** Count of Open/UnderReview disputes for the event (Req 26.3; mirrors 39.6-39.9). */
  unresolvedDisputes: number;
  /** All eligible winner disbursement batches have committed on-chain (Req 8.6, 8.7, 26.8). */
  disbursementComplete: boolean;
  /** Disbursement retries/reconciliation exhausted without recovering (Req 8.6 batching note). */
  disbursementRetriesExhausted: boolean;
  /** The refund transaction has been confirmed on-chain (Req 9.1, 9.2). */
  refundConfirmed: boolean;
  /** Automated refund retries (max 3, exponential backoff) exhausted (Req 9.4, 9.5). */
  refundRetriesExhausted: boolean;
}

/**
 * Roles permitted to trigger funding (Req 26.3): only the event Organizer or
 * the Workspace Owner.
 */
const FUNDING_ACTOR_ROLES: ReadonlySet<PlatformRole> = new Set(["Organizer", "WorkspaceOwner"]);

/**
 * Roles permitted to trigger Cancelled (Req 26.3): only the Organizer or
 * Platform Admin.
 */
const CANCEL_ACTOR_ROLES: ReadonlySet<PlatformRole> = new Set(["Organizer", "PlatformAdmin"]);

/**
 * Terminal escrow states — funds have completed their lifecycle (paid out to
 * winners or returned to the funder) and no further balance movement is
 * expected. Unlike the event lifecycle (Req 23.7, where Cancelled is
 * terminal), Requirement 26 does not name terminal escrow states explicitly;
 * this is derived from the requirement text: Cancelled on the escrow always
 * triggers the refund workflow (Req 9.1) and so is a waypoint toward
 * Refunded, not an end state, and Failed remains recoverable via manual
 * review (Req 26.7 — "until manual review resolves the discrepancy").
 * Released and Refunded are the only states after which no further escrow
 * balance change is described anywhere in Requirement 26 or 8/9.
 */
export const ESCROW_TERMINAL: ReadonlySet<EscrowState> = new Set(["Released", "Refunded"]);

export function isEscrowTerminal(state: EscrowState): boolean {
  return ESCROW_TERMINAL.has(state);
}

/** Cumulative-funding-driven funding tier (Req 26.2). */
function fundingTier(ctx: EscrowContext): "PendingFunding" | "PartiallyFunded" | "FullyFunded" {
  if (ctx.cumulativeConfirmedDeposits >= ctx.fundingTarget) return "FullyFunded";
  if (ctx.cumulativeConfirmedDeposits > 0) return "PartiallyFunded";
  return "PendingFunding";
}

/** Reconciliation passes when on-chain balance matches the DB-expected balance and no flag is set (Req 26.4, 26.5). */
function reconciled(ctx: EscrowContext): boolean {
  return !ctx.inconsistent && ctx.onChainBalance === ctx.expectedBalance;
}

interface Edge {
  to: EscrowState;
  /** Returns unmet-precondition messages; empty array means the edge is currently satisfiable. */
  unmet(ctx: EscrowContext): string[];
}

function fundingActorCheck(ctx: EscrowContext): string[] {
  if (ctx.isAutomated) return [];
  if (!ctx.actorRole || !FUNDING_ACTOR_ROLES.has(ctx.actorRole)) {
    return ["funding may only be triggered by the event Organizer or Workspace Owner (Req 26.3)"];
  }
  return [];
}

function cancelActorCheck(ctx: EscrowContext): string[] {
  if (!ctx.actorRole || !CANCEL_ACTOR_ROLES.has(ctx.actorRole)) {
    return ["cancellation may only be triggered by the Organizer or Platform Admin (Req 26.3)"];
  }
  return [];
}

/**
 * Automated transitions (Locked, PendingRelease, Released — Req 26.3) are
 * blocked entirely while the escrow is flagged inconsistent, until manual
 * review clears the flag (Req 26.7, Property 13).
 */
function automationGuard(ctx: EscrowContext): string[] {
  if (ctx.isAutomated && ctx.inconsistent) {
    return [
      "escrow is flagged inconsistent; automated transitions are blocked until manual review (Req 26.7)",
    ];
  }
  return [];
}

const GRAPH: Record<EscrowState, Edge[]> = {
  PendingFunding: [
    // Self-stay while no qualifying deposit has landed yet (no-op, always satisfiable).
    { to: "PendingFunding", unmet: () => [] },
    {
      to: "PartiallyFunded",
      unmet: (ctx) => {
        const reasons = fundingActorCheck(ctx);
        if (fundingTier(ctx) !== "PartiallyFunded") {
          reasons.push(
            "requires cumulative confirmed deposits greater than 0 and below the funding target (Req 26.2)",
          );
        }
        return reasons;
      },
    },
    {
      to: "FullyFunded",
      unmet: (ctx) => {
        const reasons = fundingActorCheck(ctx);
        if (fundingTier(ctx) !== "FullyFunded") {
          reasons.push(
            "requires cumulative confirmed deposits to meet or exceed the funding target (Req 26.2)",
          );
        }
        return reasons;
      },
    },
    { to: "Cancelled", unmet: (ctx) => cancelActorCheck(ctx) },
    // Unrecoverable funding failure requiring manual recovery (Req 26.9 keeps
    // the escrow in place and allows retry on ordinary failure; Failed is
    // reserved for the exhausted-retry case surfaced to Admin/Organizer).
    {
      to: "Failed",
      unmet: (ctx) =>
        ctx.refundRetriesExhausted || ctx.disbursementRetriesExhausted
          ? []
          : ["no unrecoverable failure reported"],
    },
  ],
  PartiallyFunded: [
    // Self-stay: an additional confirmed deposit that does not cross the target yet.
    {
      to: "PartiallyFunded",
      unmet: (ctx) =>
        fundingTier(ctx) === "PartiallyFunded"
          ? []
          : ["cumulative confirmed deposits no longer match the Partially Funded tier (Req 26.2)"],
    },
    {
      to: "FullyFunded",
      unmet: (ctx) => {
        const reasons = fundingActorCheck(ctx);
        if (fundingTier(ctx) !== "FullyFunded") {
          reasons.push(
            "requires cumulative confirmed deposits to meet or exceed the funding target (Req 26.2)",
          );
        }
        return reasons;
      },
    },
    { to: "Cancelled", unmet: (ctx) => cancelActorCheck(ctx) },
    {
      to: "Failed",
      unmet: (ctx) =>
        ctx.refundRetriesExhausted || ctx.disbursementRetriesExhausted
          ? []
          : ["no unrecoverable failure reported"],
    },
  ],
  FullyFunded: [
    {
      to: "Locked",
      unmet: (ctx) => {
        const reasons = automationGuard(ctx);
        if (!ctx.isAutomated)
          reasons.push("Locked is only reached via the automated Platform transition (Req 26.3)");
        if (!reconciled(ctx)) {
          reasons.push(
            "on-chain balance must be verified against the expected funded amount before locking (Req 26.4)",
          );
        }
        return reasons;
      },
    },
    { to: "Cancelled", unmet: (ctx) => cancelActorCheck(ctx) },
    {
      to: "Failed",
      unmet: (ctx) =>
        ctx.refundRetriesExhausted || ctx.disbursementRetriesExhausted
          ? []
          : ["no unrecoverable failure reported"],
    },
  ],
  Locked: [
    {
      to: "PendingRelease",
      unmet: (ctx) => {
        const reasons = automationGuard(ctx);
        if (!ctx.isAutomated)
          reasons.push(
            "PendingRelease is only reached via the automated Platform transition (Req 26.3)",
          );
        if (!ctx.reviewWindowElapsed)
          reasons.push("Review (Objection Window) has not elapsed (Req 26.3, 39.6-39.9)");
        if (ctx.unresolvedDisputes > 0)
          reasons.push("unresolved disputes remain open (Req 26.3, 39.6-39.9)");
        return reasons;
      },
    },
    { to: "Cancelled", unmet: (ctx) => cancelActorCheck(ctx) },
    {
      to: "Failed",
      unmet: (ctx) =>
        ctx.disbursementRetriesExhausted ? [] : ["no unrecoverable disbursement failure reported"],
    },
  ],
  PendingRelease: [
    {
      to: "Released",
      unmet: (ctx) => {
        const reasons = automationGuard(ctx);
        if (!ctx.isAutomated)
          reasons.push("Released is only reached via the automated Platform transition (Req 26.3)");
        if (!ctx.disbursementComplete)
          reasons.push("disbursement to eligible winners has not completed (Req 8.6, 8.7, 26.8)");
        return reasons;
      },
    },
    { to: "Cancelled", unmet: (ctx) => cancelActorCheck(ctx) },
    {
      to: "Failed",
      unmet: (ctx) =>
        ctx.disbursementRetriesExhausted ? [] : ["no unrecoverable disbursement failure reported"],
    },
  ],
  Released: [],
  Cancelled: [
    {
      to: "Refunded",
      unmet: (ctx) =>
        ctx.refundConfirmed
          ? []
          : ["refund transaction has not been confirmed on-chain (Req 9.1, 9.2)"],
    },
    {
      to: "Failed",
      unmet: (ctx) =>
        ctx.refundRetriesExhausted
          ? []
          : ["automated refund retries have not been exhausted (Req 9.4, 9.5)"],
    },
  ],
  Refunded: [],
  Failed: [
    // Manual review has resolved the discrepancy/failure (Req 26.7) and an
    // Organizer/Platform Admin now cancels the escrow to route toward refund.
    {
      to: "Cancelled",
      unmet: (ctx) => {
        const reasons = cancelActorCheck(ctx);
        if (ctx.inconsistent)
          reasons.push("manual review has not cleared the inconsistent flag (Req 26.7)");
        return reasons;
      },
    },
    // Manual review resolved the discrepancy and the refund was separately confirmed on-chain.
    {
      to: "Refunded",
      unmet: (ctx) => {
        const reasons: string[] = [];
        if (ctx.inconsistent)
          reasons.push("manual review has not cleared the inconsistent flag (Req 26.7)");
        if (!ctx.refundConfirmed)
          reasons.push("refund transaction has not been confirmed on-chain (Req 9.1, 9.2)");
        return reasons;
      },
    },
  ],
};

/**
 * Validates a requested escrow transition against the canonical transition
 * graph and its preconditions (Req 26.1-26.4). Route handlers/services call
 * this before any database write; on failure the caller returns 422 with
 * `{ currentState, requestedState, validOutbound, unmetPreconditions }`
 * (mirrors Req 6.4, 23.5 for the event lifecycle).
 */
export function canEscrowTransition(
  from: EscrowState,
  to: EscrowState,
  ctx: EscrowContext,
): TransitionResult {
  const edges = GRAPH[from];

  const validOutbound = edges.filter((edge) => edge.unmet(ctx).length === 0).map((edge) => edge.to);

  const targetEdge = edges.find((edge) => edge.to === to);

  if (!targetEdge) {
    return {
      ok: false,
      validOutbound,
      unmetPreconditions: [
        `no transition from ${from} to ${to} exists in the escrow lifecycle (Req 26.1)`,
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
 * Returns every escrow state reachable from `from` given the current
 * context — i.e. every `to` for which `canEscrowTransition` returns
 * `ok: true`. Mirrors the event lifecycle module's `validOutboundStates`
 * (`./event.ts`) for a consistent shared-module surface across lifecycles
 * (Req 6.2).
 */
export function validEscrowOutboundStates(from: EscrowState, ctx: EscrowContext): EscrowState[] {
  return GRAPH[from].filter((edge) => edge.unmet(ctx).length === 0).map((edge) => edge.to);
}
