/**
 * Dispute lifecycle state machine (Req 39).
 *
 * Pure module — no I/O — exporting `canDisputeTransition` over the 5 canonical
 * dispute states with role- and filer-gated transitions. Importable by both
 * server services and client UI. Mirrors the consistent `TransitionResult`
 * shape used by the event and escrow lifecycle modules.
 */
import type { DisputeState, PlatformRole } from "@/types";

/**
 * Result of a requested dispute transition (consistent with event/escrow
 * modules for a uniform 422 payload shape).
 */
export interface DisputeTransitionResult {
  ok: boolean;
  validOutbound: DisputeState[];
  unmetPreconditions: string[];
}

/**
 * Terminal dispute states (Req 39.1) — no further transitions permitted.
 */
export const DISPUTE_TERMINAL: ReadonlySet<DisputeState> = new Set([
  "Upheld",
  "Dismissed",
  "Withdrawn",
]);

export function isDisputeTerminal(state: DisputeState): boolean {
  return DISPUTE_TERMINAL.has(state);
}

/** Roles that can move Open → UnderReview (Req 39.3). */
const REVIEW_ROLES: ReadonlySet<PlatformRole> = new Set([
  "Organizer",
  "PlatformAdmin",
  "WorkspaceAdmin",
]);

/** Roles that can resolve disputes (Upheld/Dismissed) (Req 39.4). */
const RESOLVE_ROLES: ReadonlySet<PlatformRole> = new Set([
  "Organizer",
  "PlatformAdmin",
  "WorkspaceAdmin",
]);

interface Edge {
  to: DisputeState;
  unmet(actorRole: PlatformRole, isFiler: boolean): string[];
}

const GRAPH: Record<DisputeState, Edge[]> = {
  Open: [
    {
      to: "UnderReview",
      unmet: (actorRole) =>
        REVIEW_ROLES.has(actorRole)
          ? []
          : ["only Organizer, PlatformAdmin, or WorkspaceAdmin can move to UnderReview (Req 39.3)"],
    },
    {
      to: "Upheld",
      unmet: (actorRole) =>
        RESOLVE_ROLES.has(actorRole)
          ? []
          : ["only Organizer, PlatformAdmin, or WorkspaceAdmin can uphold a dispute (Req 39.4)"],
    },
    {
      to: "Dismissed",
      unmet: (actorRole) =>
        RESOLVE_ROLES.has(actorRole)
          ? []
          : ["only Organizer, PlatformAdmin, or WorkspaceAdmin can dismiss a dispute (Req 39.4)"],
    },
    {
      to: "Withdrawn",
      unmet: (_actorRole, isFiler) =>
        isFiler ? [] : ["only the original filer can withdraw a dispute (Req 39.3)"],
    },
  ],
  UnderReview: [
    {
      to: "Upheld",
      unmet: (actorRole) =>
        RESOLVE_ROLES.has(actorRole)
          ? []
          : ["only Organizer, PlatformAdmin, or WorkspaceAdmin can uphold a dispute (Req 39.4)"],
    },
    {
      to: "Dismissed",
      unmet: (actorRole) =>
        RESOLVE_ROLES.has(actorRole)
          ? []
          : ["only Organizer, PlatformAdmin, or WorkspaceAdmin can dismiss a dispute (Req 39.4)"],
    },
    {
      to: "Withdrawn",
      unmet: (_actorRole, isFiler) =>
        isFiler ? [] : ["only the original filer can withdraw a dispute (Req 39.3)"],
    },
  ],
  Upheld: [],
  Dismissed: [],
  Withdrawn: [],
};

/**
 * Validates a requested dispute state transition against the canonical graph
 * with role and filer gating (Req 39.1, 39.3, 39.4).
 */
export function canDisputeTransition(
  from: DisputeState,
  to: DisputeState,
  actorRole: PlatformRole,
  isFiler: boolean,
): DisputeTransitionResult {
  const edges = GRAPH[from];

  const validOutbound = edges
    .filter((edge) => edge.unmet(actorRole, isFiler).length === 0)
    .map((edge) => edge.to);

  const targetEdge = edges.find((edge) => edge.to === to);

  if (!targetEdge) {
    return {
      ok: false,
      validOutbound,
      unmetPreconditions: [
        `no transition from ${from} to ${to} exists in the dispute lifecycle (Req 39.1)`,
      ],
    };
  }

  const unmetPreconditions = targetEdge.unmet(actorRole, isFiler);

  return {
    ok: unmetPreconditions.length === 0,
    validOutbound,
    unmetPreconditions,
  };
}

/**
 * Returns every dispute state reachable from `from` given the actor's role
 * and filer status.
 */
export function validDisputeOutboundStates(
  from: DisputeState,
  actorRole: PlatformRole,
  isFiler: boolean,
): DisputeState[] {
  return GRAPH[from]
    .filter((edge) => edge.unmet(actorRole, isFiler).length === 0)
    .map((edge) => edge.to);
}
