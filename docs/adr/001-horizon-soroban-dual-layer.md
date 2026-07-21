# ADR-001: Horizon as Execution Layer, Soroban as State Tracking

**Status**: Accepted
**Date**: 2026-07-21
**Authors**: Architecture Team

---

## Context

Stellar Guardian manages escrow accounts for hackathon prize distribution. The platform must:
1. Accept deposits from organizers and sponsors (any wallet)
2. Disburse prizes to multiple winners in batches
3. Refund on event cancellation
4. Track escrow lifecycle state

Two Stellar interfaces are available:
- **Horizon API**: Direct Stellar payments, account management, transaction history
- **Soroban Smart Contracts**: Programmable on-chain logic with enforced state transitions

## Decision

We adopt a **dual-layer architecture**:

- **Horizon** is the **execution layer** — all fund transfers (deposits, disbursements, refunds) are standard Stellar payment operations submitted via the Horizon API.
- **Soroban** is the **state-tracking layer** — the escrow contract records lifecycle state on-chain for public verifiability, but does not execute the actual transfers.

## Rationale

### Why not Soroban-only?

1. **Deposit flexibility**: The Soroban contract only allows the `organizer` address to `deposit()`. Sponsors (third-party wallets) cannot deposit. Changing this requires a contract upgrade, which is complex and risky on mainnet.

2. **Batch size limitations**: The contract's `disburse()` method transitions to `Released` after a single call. Events with >100 winners require multiple batches, which the current contract doesn't support.

3. **Cost efficiency**: Standard Horizon payments have lower gas costs than Soroban contract invocations for simple transfers.

4. **Simplicity**: The backend already has full control of the escrow keypair (KMS-encrypted). Standard payments are simpler to build, sign, and debug.

### Why keep Soroban at all?

1. **Public verifiability**: Anyone can query the contract's `get_state()` and `get_balance()` to verify the escrow lifecycle independently of the platform's database.

2. **Trust signal**: "Smart contract backed" is a marketing differentiator and trust indicator for participants.

3. **Future migration path**: When the contract is upgraded (ADR-002, planned), it can become the full execution layer with multi-batch disbursement support.

## State Mapping

| Backend State (DB) | Contract State | Sync Direction |
|-------------------|---------------|----------------|
| PendingFunding | PendingFunding (0) | Backend → Contract (on creation) |
| PartiallyFunded | PartiallyFunded (1) | Backend → Contract (on deposit verification) |
| FullyFunded | FullyFunded (2) | Backend → Contract (on target reached) |
| Locked | Locked (3) | Backend → Contract (on lock) |
| PendingRelease | Locked (3) | No contract change (backend-only mutex) |
| Released | Released (4) | Backend → Contract (on finalization) |
| Refunded | Refunded (5) | Backend → Contract (on refund) |
| Failed | N/A | Backend-only recovery state |
| Cancelled | Refunded (5) | Triggers refund flow, then maps |

## Reconciliation

The `VerificationService.reconcileEscrow()` function:
1. Reads the on-chain balance via Horizon (`stellar.getBalance()`)
2. Reads the contract state via Soroban RPC (`contract.get_state()`)
3. Compares both against the database `escrow_accounts` record
4. Sets `inconsistent = true` if any divergence is detected
5. Alerts the organizer and platform admin

## Consequences

### Positive
- Sponsors can fund escrows from any wallet
- Multi-batch disbursement works without contract limitations
- Lower gas costs for standard operations
- Public verifiability maintained via contract state queries

### Negative
- Two sources of truth require reconciliation
- Contract state can lag behind actual on-chain balance
- Contract deployment still required per event (gas cost)
- Future contract upgrade needed for full decentralization

### Risks
- State divergence between Horizon balance and contract state
  - Mitigated by: scheduled reconciliation cron (every 30 minutes)
- Contract TTL expiry for long-running escrows
  - Mitigated by: TTL refresh on every write operation

## Future Work (ADR-002 — planned)

- Add `admin_deposit(from, amount)` for sponsor deposits via contract
- Split `disburse()` into `disburse_batch()` + `finalize()`
- Deploy per-event contract instances (factory pattern)
- Full security audit before mainnet execution-layer migration
