# ADR-001: Escrow Architecture — Horizon as Execution Layer, Soroban as State Tracking

**Status**: Accepted  
**Date**: July 21, 2026  
**Decision Makers**: Principal Architect, Backend Lead, Blockchain Engineer

## Context

Stellar Guardian has two escrow implementations:

1. **Horizon-based** (`lib/stellar/client.ts`): Platform holds a custodied keypair, builds payment operations, and submits directly via Horizon API.
2. **Soroban-based** (`lib/stellar/soroban-escrow.ts`): A smart contract tracks escrow state (PendingFunding → FullyFunded → Locked → Released/Refunded).

Both exist but serve different purposes. The backend services (`lib/services/escrow/`) use the Horizon path for actual fund transfers. The Soroban contract exists as a parallel state-tracking mechanism.

## Decision

**Horizon is the execution layer. Soroban is the state-tracking layer.**

- All fund transfers (deposits, disbursements, refunds) execute via Horizon payment operations signed with the escrow keypair.
- The Soroban contract is updated post-execution to reflect the new state for on-chain auditability.
- The backend database is the primary source of truth for operational state.
- Reconciliation compares all three sources: DB state, Horizon balance, and Soroban contract state.

## State Mapping

| Backend State | Soroban State | Notes |
|--------------|---------------|-------|
| PendingFunding | PendingFunding (0) | Direct map |
| PartiallyFunded | PartiallyFunded (1) | Direct map |
| FullyFunded | FullyFunded (2) | Direct map |
| Locked | Locked (3) | Backend calls `contract.lock()` |
| PendingRelease | Locked (3) | Backend-only mutex state |
| Released | Released (4) | Backend calls `contract.finalize()` |
| Refunded | Refunded (5) | Backend calls `contract.refund()` |
| Failed | N/A | Backend-only recovery state |
| Cancelled | Refunded (5) | Backend triggers refund first |

## Rationale

1. **Simplicity**: Horizon payments are well-understood, battle-tested, and don't require contract simulation/assembly.
2. **Sponsor support**: The Soroban contract restricts deposits to the organizer address. Sponsors need to deposit from arbitrary wallets — Horizon allows this naturally.
3. **Batch flexibility**: Horizon supports up to 100 operations per transaction natively. The Soroban contract's `disburse()` transitions to Released after one call, blocking multi-batch scenarios.
4. **Auditability**: The Soroban contract provides an immutable on-chain record of state transitions, complementing the DB audit trail.
5. **Progressive decentralization**: Phase 4 will expand the Soroban contract to support `admin_deposit` and `disburse_batch` + `finalize`, enabling a future migration to fully on-chain execution.

## Consequences

- The system has "dual truth" — DB and on-chain. Reconciliation service must detect and alert on divergence.
- The Soroban contract is not enforcing rules (the backend does). It's a transparency/audit mechanism.
- Future mainnet deployment requires the contract to be updated before full trustless execution is possible.
- Three extra states exist in the backend (Failed, Cancelled, PendingRelease) that have no on-chain equivalent.

## Future Migration Path (Phase 4)

1. Add `admin_deposit(from, amount)` to allow sponsor deposits via contract.
2. Split `disburse()` into `disburse_batch()` (no state change) + `finalize()` (→ Released).
3. Deploy per-event contract instances (factory pattern).
4. Migrate execution from Horizon to Soroban once contract passes security audit.
