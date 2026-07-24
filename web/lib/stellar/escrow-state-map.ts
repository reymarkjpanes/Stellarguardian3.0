/**
 * Backend ↔ Soroban Contract State Mapping (ADR-001).
 *
 * The backend has 9 escrow states; the Soroban contract has 6.
 * Three backend-only states (Failed, Cancelled, PendingRelease)
 * represent operational concerns with no on-chain equivalent.
 *
 * This mapping is used by the reconciliation service to compare
 * DB state against on-chain contract state.
 */

import type { EscrowState } from "@/types";

/**
 * Soroban contract state values (from get_state() → u32).
 */
export const SOROBAN_STATE = {
  PendingFunding: 0,
  PartiallyFunded: 1,
  FullyFunded: 2,
  Locked: 3,
  Released: 4,
  Refunded: 5,
} as const;

export type SorobanStateValue = (typeof SOROBAN_STATE)[keyof typeof SOROBAN_STATE];

/**
 * Maps backend escrow states to their corresponding Soroban contract state.
 * States mapping to `null` have no on-chain equivalent (backend-only).
 */
export const BACKEND_TO_CONTRACT_STATE_MAP: Record<EscrowState, SorobanStateValue | null> = {
  PendingFunding: SOROBAN_STATE.PendingFunding,
  PartiallyFunded: SOROBAN_STATE.PartiallyFunded,
  FullyFunded: SOROBAN_STATE.FullyFunded,
  Locked: SOROBAN_STATE.Locked,
  PendingRelease: SOROBAN_STATE.Locked, // Backend-only mutex state; contract stays Locked
  Released: SOROBAN_STATE.Released,
  Refunded: SOROBAN_STATE.Refunded,
  Failed: null, // Backend-only recovery state
  Cancelled: SOROBAN_STATE.Refunded, // Cancellation triggers refund on-chain
};

/**
 * Maps a Soroban state integer back to the most likely backend state.
 * Used during reconciliation to interpret contract query results.
 */
export const CONTRACT_TO_BACKEND_STATE_MAP: Record<SorobanStateValue, EscrowState> = {
  [SOROBAN_STATE.PendingFunding]: "PendingFunding",
  [SOROBAN_STATE.PartiallyFunded]: "PartiallyFunded",
  [SOROBAN_STATE.FullyFunded]: "FullyFunded",
  [SOROBAN_STATE.Locked]: "Locked",
  [SOROBAN_STATE.Released]: "Released",
  [SOROBAN_STATE.Refunded]: "Refunded",
};

/**
 * Check if a backend state has an on-chain equivalent.
 */
export function hasOnChainEquivalent(backendState: EscrowState): boolean {
  return BACKEND_TO_CONTRACT_STATE_MAP[backendState] !== null;
}

/**
 * Check if the backend and contract states are consistent.
 * Handles the PendingRelease → Locked mapping gracefully.
 */
export function areStatesConsistent(
  backendState: EscrowState,
  contractStateValue: number,
): boolean {
  const expectedContractState = BACKEND_TO_CONTRACT_STATE_MAP[backendState];

  // Backend-only states can't be validated against the contract
  if (expectedContractState === null) return true;

  return expectedContractState === contractStateValue;
}

// --- Aliases for backward compatibility with verification.service.ts and tests ---

/** @deprecated Use BACKEND_TO_CONTRACT_STATE_MAP */
export const BACKEND_TO_CONTRACT_STATE = BACKEND_TO_CONTRACT_STATE_MAP;

/** @deprecated Use SOROBAN_STATE */
export const CONTRACT_STATES = SOROBAN_STATE;

/** @deprecated Use areStatesConsistent */
export const isStateConsistent = areStatesConsistent;

/**
 * Produce a human-readable description of state divergence between
 * backend and contract state. Used in reconciliation alerts.
 */
export function describeStateDivergence(
  backendState: EscrowState,
  contractStateValue: number,
): string {
  const expectedOnChain = BACKEND_TO_CONTRACT_STATE_MAP[backendState];
  const contractStateName =
    CONTRACT_TO_BACKEND_STATE_MAP[contractStateValue as SorobanStateValue] ??
    `Unknown(${contractStateValue})`;

  if (expectedOnChain === null) {
    return `Backend state "${backendState}" has no on-chain equivalent. Contract shows "${contractStateName}" — this may be acceptable.`;
  }

  const expectedName =
    CONTRACT_TO_BACKEND_STATE_MAP[expectedOnChain as SorobanStateValue] ??
    `Unknown(${expectedOnChain})`;

  return `State mismatch: backend="${backendState}" expects on-chain="${expectedName}" but contract reports "${contractStateName}" (value=${contractStateValue}).`;
}

/**
 * Human-readable labels for contract state integers.
 */
export const CONTRACT_STATE_LABELS: Record<SorobanStateValue, string> = {
  [SOROBAN_STATE.PendingFunding]: "PendingFunding",
  [SOROBAN_STATE.PartiallyFunded]: "PartiallyFunded",
  [SOROBAN_STATE.FullyFunded]: "FullyFunded",
  [SOROBAN_STATE.Locked]: "Locked",
  [SOROBAN_STATE.Released]: "Released",
  [SOROBAN_STATE.Refunded]: "Refunded",
};
