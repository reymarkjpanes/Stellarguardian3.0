/**
 * Escrow State Mapping — Backend ↔ Soroban Contract (ADR-001).
 *
 * The backend has 9 escrow states; the Soroban contract has 6.
 * This module defines the canonical mapping between them and provides
 * utilities for state comparison during reconciliation.
 *
 * See: docs/adr/001-horizon-soroban-dual-layer.md
 */
import type { EscrowState } from "@/types";

/**
 * Soroban contract state enum values (matches lib.rs EscrowState).
 */
export const CONTRACT_STATES = {
  PendingFunding: 0,
  PartiallyFunded: 1,
  FullyFunded: 2,
  Locked: 3,
  Released: 4,
  Refunded: 5,
} as const;

export type ContractStateValue = (typeof CONTRACT_STATES)[keyof typeof CONTRACT_STATES];

/**
 * Maps backend EscrowState → expected contract state value.
 * `null` means this backend state has no contract equivalent (backend-only).
 */
export const BACKEND_TO_CONTRACT_STATE: Record<EscrowState, ContractStateValue | null> = {
  PendingFunding: CONTRACT_STATES.PendingFunding,
  PartiallyFunded: CONTRACT_STATES.PartiallyFunded,
  FullyFunded: CONTRACT_STATES.FullyFunded,
  Locked: CONTRACT_STATES.Locked,
  PendingRelease: CONTRACT_STATES.Locked, // Backend-only mutex; contract stays Locked
  Released: CONTRACT_STATES.Released,
  Refunded: CONTRACT_STATES.Refunded,
  Failed: null, // Backend-only recovery state
  Cancelled: CONTRACT_STATES.Refunded, // Cancellation triggers refund on-chain
};

/**
 * Maps contract state value → human-readable label.
 */
export const CONTRACT_STATE_LABELS: Record<ContractStateValue, string> = {
  0: "PendingFunding",
  1: "PartiallyFunded",
  2: "FullyFunded",
  3: "Locked",
  4: "Released",
  5: "Refunded",
};

/**
 * Check if backend state and contract state are consistent.
 * Returns `true` if they match (or if backend state has no contract equivalent).
 */
export function isStateConsistent(
  backendState: EscrowState,
  contractStateValue: number,
): boolean {
  const expected = BACKEND_TO_CONTRACT_STATE[backendState];

  // Backend-only states (Failed) — always considered consistent since
  // the contract doesn't track them.
  if (expected === null) return true;

  return expected === contractStateValue;
}

/**
 * Describe a state divergence for logging/alerting.
 */
export function describeStateDivergence(
  backendState: EscrowState,
  contractStateValue: number,
): string {
  const expectedContract = BACKEND_TO_CONTRACT_STATE[backendState];
  const actualLabel = CONTRACT_STATE_LABELS[contractStateValue as ContractStateValue] ?? `Unknown(${contractStateValue})`;
  const expectedLabel = expectedContract !== null
    ? CONTRACT_STATE_LABELS[expectedContract] ?? `Unknown(${expectedContract})`
    : "N/A (backend-only)";

  return `Backend="${backendState}" expects contract="${expectedLabel}" but found contract="${actualLabel}"`;
}
