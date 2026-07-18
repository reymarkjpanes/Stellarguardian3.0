/**
 * Event lifecycle state machine (Req 6, 23 — authoritative).
 *
 * Pure module — no I/O — exporting `canTransition`, `validOutboundStates`,
 * and `isTerminal` over the 16 canonical event states. Importable by both
 * server route handlers/services and client-side UI (Req 6.2, 23.10). This
 * is the single shared implementation that supersedes and eliminates the
 * duplicate transition maps previously scattered across the legacy Express
 * app (`server.ts` `VALID_TRANSITIONS` and `src/lib/eventStatus.ts` — see
 * the removal note at the bottom of this file's module comment and the task
 * report for details).
 *
 * `EventState` is re-exported as the same type produced by the Zod
 * `EventStateSchema` (Req 1.5, 23.1) defined in `/types/enums.ts` — this
 * module does not redefine the state list, it only defines the transition
 * graph and Req 23.3 preconditions over it.
 *
 * Scope note: Req 23.4 (per-state role permission sets) is intentionally
 * NOT enforced here. `TransitionContext.actorRole` is accepted (per the
 * design document's interface) but not evaluated for gating in this
 * module — role-based authorization is the responsibility of the separate
 * Permission Matrix module (`/lib/services/permission`, Req 27, task 5.x),
 * keeping "is this transition legal" (this module) separate from "is this
 * actor allowed to trigger it" (the permission matrix). This mirrors the
 * design document's separation of the State Machine and Permission Matrix
 * sections.
 */
import type { EventState, PlatformRole } from "@/types";

/**
 * Result of a requested event transition (Req 6.4, 23.5 — shape used to
 * build the 422 payload: current state, requested state, valid outbound
 * transitions, and unmet preconditions).
 */
export interface TransitionResult {
  ok: boolean;
  /** Every state reachable from `from` given the current context — for 422 payloads. */
  validOutbound: EventState[];
  /** Human-readable reasons the requested transition is not currently permitted. */
  unmetPreconditions: string[];
}

/**
 * Context driving event transition preconditions (Req 23.3). Field shape
 * matches the design document's `TransitionContext` interface exactly.
 */
export interface TransitionContext {
  /** Number of judges assigned to the event (Req 23.3 — Published requires >= 1). */
  judgeCount: number;
  /** Configured registration deadline, if any (Req 23.3 — Registration Open requires this configured). */
  registrationDeadline?: string;
  /** Configured minimum team size, if any (Req 23.3 — Team Formation requires this configured). */
  teamSizeMin?: number;
  /** Whether the event has at least one submitted entry (Req 23.3 — Judging requires this). */
  hasSubmissions: boolean;
  /** Whether every submission has been scored (Req 23.3 — Winners Finalized requires this). */
  allSubmissionsScored: boolean;
  /** Whether full escrow funding has been confirmed on-chain (Req 23.3 — Escrow Locked requires this). */
  escrowFullyFundedOnChain: boolean;
  /** Whether the Review (Objection Window) has elapsed (Req 23.3 — Prize Distribution requires this). */
  reviewWindowElapsed: boolean;
  /** Count of unresolved (Open/UnderReview) disputes (Req 23.3, 39.7 — Prize Distribution requires zero). */
  unresolvedDisputes: number;
  /** Current registration count (Req 23.6 — Registration Open can revert to Published only if zero). */
  registrationCount: number;
  /** Current submission count (Req 23.6 — Submission Open can revert to Team Formation only if zero). */
  submissionCount: number;
  /** Acting user's role. Accepted for interface parity with the design document; not evaluated for gating in this module (see module comment — Req 23.4 is deferred to the Permission Matrix). */
  actorRole: PlatformRole;
}

/**
 * Terminal event states (Req 23.7) — no outbound transitions are permitted
 * from these states except the single explicit exception `Completed ->
 * Archived` (Req 23.8, Property 4).
 */
export const TERMINAL_STATES: ReadonlySet<EventState> = new Set([
  "Completed",
  "Cancelled",
  "Archived",
]);

/**
 * Rollback transitions for reversible states (Req 23.6). Each entry lists
 * the states reachable *backward* from the key state; the actual guard for
 * each rollback edge (always / zero registrations / zero submissions) is
 * enforced by `canTransition` via the transition graph below — this map is
 * exposed for introspection per the design document's exported signature.
 */
export const ROLLBACK_TRANSITIONS: ReadonlyMap<EventState, EventState[]> = new Map([
  ["Published", ["Draft"]],
  ["RegistrationOpen", ["Published"]],
  ["SubmissionOpen", ["TeamFormation"]],
]);

export function isTerminal(state: EventState): boolean {
  return TERMINAL_STATES.has(state);
}

interface Edge {
  to: EventState;
  /** Returns unmet-precondition messages; empty array means the edge is currently satisfiable. */
  unmet(ctx: TransitionContext): string[];
}

/** Always-satisfiable edge — used for unconditional forward steps and the "always" rollback (Published -> Draft, Req 23.6). */
function always(): string[] {
  return [];
}

/**
 * Forward + rollback transition graph, keyed by source state. `Cancelled`
 * is intentionally omitted here and merged in by `buildGraph` below so the
 * "Cancelled is reachable from any non-terminal state" invariant (Req 23.7)
 * is enforced structurally rather than by manual repetition on every state.
 */
const FORWARD_AND_ROLLBACK_EDGES: Partial<Record<EventState, Edge[]>> = {
  Draft: [
    {
      to: "Published",
      unmet: (ctx) =>
        ctx.judgeCount >= 1 ? [] : ["Published requires at least one judge assigned (Req 23.3)"],
    },
  ],
  Published: [
    // Rollback: Published -> Draft is always permitted (Req 23.6).
    { to: "Draft", unmet: always },
    {
      to: "RegistrationOpen",
      unmet: (ctx) =>
        ctx.registrationDeadline !== undefined && ctx.registrationDeadline !== ""
          ? []
          : ["Registration Open requires a registration deadline configured (Req 23.3)"],
    },
  ],
  RegistrationOpen: [
    // Rollback: RegistrationOpen -> Published only if zero registrations exist (Req 23.6).
    {
      to: "Published",
      unmet: (ctx) =>
        ctx.registrationCount === 0
          ? []
          : [
              "Registration Open can only revert to Published while zero registrations exist (Req 23.6)",
            ],
    },
    { to: "RegistrationClosed", unmet: always },
  ],
  RegistrationClosed: [
    {
      to: "TeamFormation",
      unmet: (ctx) =>
        ctx.teamSizeMin !== undefined
          ? []
          : ["Team Formation requires teamSizeMin configured (Req 23.3)"],
    },
    {
      to: "SubmissionOpen",
      unmet: (ctx) =>
        ctx.teamSizeMin === undefined
          ? []
          : [
              "Submission Open from Registration Closed is only permitted for solo events with no team formation configured (Req 23.3)",
            ],
    },
  ],
  TeamFormation: [
    // Submission Open requires Team Formation complete (Req 23.3); being in
    // this state and requesting the transition signals completion.
    { to: "SubmissionOpen", unmet: always },
    // Rollback: SubmissionOpen -> TeamFormation lives on the SubmissionOpen
    // edge list below (guarded by zero submissions); TeamFormation itself
    // has no backward edge to an earlier state per Req 23.6.
  ],
  SubmissionOpen: [
    // Rollback: SubmissionOpen -> TeamFormation only if zero submissions exist (Req 23.6).
    {
      to: "TeamFormation",
      unmet: (ctx) =>
        ctx.submissionCount === 0
          ? []
          : [
              "Submission Open can only revert to Team Formation while zero submissions exist (Req 23.6)",
            ],
    },
    { to: "SubmissionClosed", unmet: always },
  ],
  SubmissionClosed: [
    {
      to: "Judging",
      unmet: (ctx) =>
        ctx.hasSubmissions
          ? []
          : ["Judging requires Submission Closed with at least one submitted entry (Req 23.3)"],
    },
  ],
  Judging: [
    // No explicit Req 23.3 precondition is listed for leaving Judging itself
    // (entry into Judging is already gated by `hasSubmissions` above, on the
    // SubmissionClosed edge); the "all submissions scored" precondition is
    // attributed by Req 23.3 to entering *Winners Finalized*, not to entering
    // the Review (Objection Window) — see the ReviewObjectionWindow edge below.
    { to: "ReviewObjectionWindow", unmet: always },
  ],
  ReviewObjectionWindow: [
    {
      to: "WinnersFinalized",
      unmet: (ctx) =>
        ctx.allSubmissionsScored
          ? []
          : ["Winners Finalized requires all submissions to be scored (Req 23.3)"],
    },
  ],
  WinnersFinalized: [{ to: "OrganizerFundsEscrow", unmet: always }],
  OrganizerFundsEscrow: [
    {
      to: "EscrowLocked",
      unmet: (ctx) =>
        ctx.escrowFullyFundedOnChain
          ? []
          : ["Escrow Locked requires full escrow funding confirmed on-chain (Req 23.3)"],
    },
  ],
  EscrowLocked: [
    {
      to: "PrizeDistribution",
      unmet: (ctx) => {
        const reasons: string[] = [];
        if (!ctx.reviewWindowElapsed) {
          reasons.push("Prize Distribution requires the Review window to have elapsed (Req 23.3)");
        }
        if (ctx.unresolvedDisputes > 0) {
          reasons.push("Prize Distribution requires zero unresolved disputes (Req 23.3, 39.7)");
        }
        return reasons;
      },
    },
  ],
  PrizeDistribution: [{ to: "Completed", unmet: always }],
  // Completed's only outbound edge (Completed -> Archived, Req 23.8) is
  // merged in by buildGraph as the sole terminal-state exception (Property 4).
  Completed: [],
  Cancelled: [],
  Archived: [],
};

const ALL_STATES: EventState[] = [
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
  "Completed",
  "Cancelled",
  "Archived",
];

/**
 * Builds the full transition graph by merging the explicit forward/rollback
 * edges above with the structural invariants from Req 23.7/23.8 and
 * Property 4: `Cancelled` is reachable from every non-terminal state, and
 * terminal states have no outbound transitions except `Completed ->
 * Archived`.
 */
function buildGraph(): Record<EventState, Edge[]> {
  const graph = {} as Record<EventState, Edge[]>;

  for (const state of ALL_STATES) {
    const edges = [...(FORWARD_AND_ROLLBACK_EDGES[state] ?? [])];

    if (!TERMINAL_STATES.has(state)) {
      // Cancelled is reachable from any non-terminal state (Req 23.7).
      edges.push({ to: "Cancelled", unmet: always });
    }

    graph[state] = edges;
  }

  // Sole terminal-state outbound exception (Req 23.8, Property 4).
  graph.Completed.push({ to: "Archived", unmet: always });

  return graph;
}

const GRAPH: Record<EventState, Edge[]> = buildGraph();

/**
 * Validates a requested event state transition against the canonical
 * transition map and Req 23.3 preconditions. Returns `ok: true` only when
 * the transition exists in the map AND every precondition for that
 * transition is satisfied. Route handlers call this before any database
 * write; on failure they return 422 with `{ currentState, requestedState,
 * validOutbound, unmetPreconditions }` (Req 6.4, 23.5).
 */
export function canTransition(
  from: EventState,
  to: EventState,
  ctx: TransitionContext,
): TransitionResult {
  const edges = GRAPH[from];

  const validOutbound = edges.filter((edge) => edge.unmet(ctx).length === 0).map((edge) => edge.to);

  const targetEdge = edges.find((edge) => edge.to === to);

  if (!targetEdge) {
    return {
      ok: false,
      validOutbound,
      unmetPreconditions: [
        `no transition from ${from} to ${to} exists in the event lifecycle (Req 23.2)`,
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
 * Returns every state reachable from `from` given the current context —
 * i.e. every `to` for which `canTransition` returns `ok: true`.
 */
export function validOutboundStates(from: EventState, ctx: TransitionContext): EventState[] {
  return GRAPH[from].filter((edge) => edge.unmet(ctx).length === 0).map((edge) => edge.to);
}
