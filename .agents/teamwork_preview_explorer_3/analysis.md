# Technical Analysis: Requirement 3 — Automated Escrow Trigger (Soroban On-Chain Payout)

## Executive Summary
This document provides a comprehensive technical analysis for **Requirement 3: Automated Escrow Trigger** in Stellar Guardian 3.0. The goal of Requirement 3 is to replace manual platform intervention with an automated background trigger or webhook handler that detects when an event reaches the `PrizeApproved` state, validates safety constraints, and executes the on-chain prize payout via Soroban smart contracts (`contracts/escrow/src/lib.rs`).

---

## 1. Inspection of Existing Smart Contracts & Soroban SDK Integration

### 1.1 Soroban Smart Contract (`contracts/escrow/src/lib.rs`)
The Soroban escrow contract implements a strict lifecycle state machine to guarantee trustless escrow operation:

```
[PendingFunding (0)] ──deposit/admin_deposit──> [PartiallyFunded (1)] ──deposit/admin_deposit──> [FullyFunded (2)]
                                                                                                        │
                                                                                                      lock()
                                                                                                        ▼
[Released (4)] <──finalize()── [Locked (3)] <──disburse_batch(recipients, amounts)──────────────────────┘
      ▲                           │
      └──────disburse()───────────┘ (legacy single-batch)
```

**Key Smart Contract Functions**:
1. **`initialize(env, admin: Address, organizer: Address, event_id: Bytes, target: i128, token: Address)`** (lines 61–95): Initializes contract storage with admin keypair, organizer address, target stroops, and SEP-41 token wrapper contract.
2. **`deposit(env, from: Address, amount: i128)`** (lines 99–139): Organizer deposits tokens. Transitions state to `PartiallyFunded` or `FullyFunded`.
3. **`admin_deposit(env, from: Address, amount: i128)`** (lines 143–182): Admin-authorized deposit for sponsors from any wallet address.
4. **`lock(env)`** (lines 185–205): Must be `FullyFunded`. Admin authorizes locking. Transitions contract state to `Locked (3)`. Once locked, no further deposits are permitted.
5. **`disburse_batch(env, recipients: Vec<Address>, amounts: Vec<i128>)`** (lines 210–261): Admin authorizes prize payout to a vector of recipient addresses with matching stroop amounts (`i128`). Does **not** change state from `Locked`, enabling multi-batch disbursements.
6. **`finalize(env)`** (lines 320–336): Called after all `disburse_batch` calls complete. Transitions contract state to `Released (4)`.
7. **`refund(env)`** (lines 340–368): Returns remaining funds to the organizer on event cancellation.

### 1.2 Server-Side Soroban Client (`web/lib/stellar/soroban-escrow.ts`)
The server-side Soroban integration client provides TypeScript abstractions over `@stellar/stellar-sdk`:
- **`lockEscrow({ platformSecretKey, contractId })`** (lines 269–293): Invokes contract `lock()` using platform admin keypair.
- **`executeSorobanDisbursementBatch({ recipients, amounts, platformSecretKey, contractId })`** (lines 301–337): Converts addresses (`Address.toScVal()`) and amounts (`nativeToScVal(i128)`), builds transaction, simulates via Soroban RPC, signs with platform admin keypair, submits, and polls for ledger confirmation.
- **`finalizeDisbursement({ platformSecretKey, contractId })`** (lines 345–369): Invokes contract `finalize()` to set state to `Released`.
- **`queryEscrowState(platformSecretKey, contractId)`** (lines 409–484): Queries `get_balance`, `get_state`, `is_locked`, `get_target`, `get_disbursed_total` via read-only simulation calls.

---

## 2. Database Schema & State Transitions to `PrizeApproved`

### 2.1 Database Schema Context
From migrations (`web/supabase/migrations/20250101000048_module8_escrow_domain.sql` and `20250101000005_escrow_and_transactions.sql`):
- **`events`**: Contains `state` (`Draft` → ... → `DisputeWindow` → `PrizeApproved` → `EscrowRelease` → `Completed`), `version`, `prize_pool_target`, `review_window_hours`.
- **`escrow_accounts`**: Stores `id`, `event_id`, `contract_address`, `status` (`Draft`, `Funding`, `Funded`, `Verified`, `Locked`, `Releasing`, `Completed`), `expected_balance`, `available_balance`, `locked_balance`, `prize_allocation_batch_id`.
- **`disputes`**: Stores event disputes (`state IN ('Open', 'UnderReview')`).
- **`payout_batches`**: Stores `id`, `escrow_id`, `prize_allocation_batch_id`, `status` (`Pending`, `Preparing`, `Signing`, `Broadcast`, `Confirmed`, `Failed`), `idempotency_key`.
- **`payout_instructions`**: Stores `id`, `payout_batch_id`, `allocation_id`, `recipient_wallet`, `amount`, `status` (`Pending`, `Broadcast`, `Confirmed`, `Failed`), `tx_hash`, `failure_reason`.

### 2.2 Transition to `PrizeApproved` State
- **Trigger**: Organizers or system call `PATCH /api/events/[id]/state` with `target_state: "PrizeApproved"` (`web/app/api/events/[id]/state/route.ts`).
- **Preconditions Validated**:
  1. Review window has elapsed (`review_window_hours`).
  2. Zero unresolved disputes exist (`disputes.state NOT IN ('Open', 'UnderReview')`).
  3. Winners have been finalized.

---

## 3. Analysis of Manual vs. Existing Automation Flows

### 3.1 Manual Execution Flow (Legacy)
Currently, in `web/app/(app)/events/[id]/event-detail-client.tsx` (lines 388–395):
1. Organizer clicks "Release Escrow" when event state is `PrizeApproved`.
2. Frontend triggers state update or backend call to `DisbursementService.executeDisbursement()`.
3. System decrypts KMS secret, builds transaction, and broadcasts to Horizon/Soroban.

### 3.2 Existing Cron Automation Baseline
In `web/app/api/cron/escrow/route.ts`:
- Vercel Cron route running every 5 minutes.
- Queries `events` where `state = 'PrizeApproved'`.
- Validates no open disputes exist.
- Checks `escrow_accounts.state === 'FullyFunded'`.
- Optimistically updates `events.state` to `EscrowRelease` (`version: event.version + 1`).
- Generates payout batch (`service.generatePayoutBatch`) and executes payout (`service.executePayoutBatch`).

### 3.3 Core Gap to Satisfy Requirement 3
The existing cron calls `EscrowService` which currently defaults to `StellarEscrowAdapter` (Horizon native payments). To satisfy **Requirement 3**, the automated trigger must directly execute payouts via **Soroban smart contracts** (`soroban-escrow.ts`), enforcing on-chain state locking (`lockEscrow()`), batch disbursement (`executeSorobanDisbursementBatch()`), and finalization (`finalizeDisbursement()`).

---

## 4. Technical Design for Automated Escrow Trigger

### 4.1 Architecture Strategy: Hybrid Webhook + Resilience Worker
We design a **two-tier automated escrow trigger system**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │ Event State Transition to 'PrizeApproved'                   │
 │ (PATCH /api/events/[id]/state OR Supabase DB Webhook)       │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Primary Trigger: Event Bus / Webhook Endpoint               │
 │ POST /api/webhooks/escrow-trigger (Immediate async execution)│
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Failover / Polling)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Secondary Trigger: Escrow Automation Cron Worker            │
 │ POST /api/cron/escrow (Runs every 1-5 minutes)             │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Soroban Automated Payout Pipeline                           │
 │ 1. Safety Checks (Zero disputes, FullyFunded)                │
 │ 2. State Mutex (Set event to EscrowRelease)                  │
 │ 3. Contract Lock (lockEscrow via Soroban RPC)               │
 │ 4. Batch Disbursement (executeSorobanDisbursementBatch)      │
 │ 5. Contract Finalization (finalizeDisbursement)             │
 │ 6. Record Tx Hashes & Update DB Status                      │
 └─────────────────────────────────────────────────────────────┘
```

### 4.2 Step-by-Step Payout Execution Pipeline

#### Step 1: Pre-Flight Safety Checks
Before invoking any Soroban smart contract logic:
1. **Dispute Window Validation**:
   ```ts
   const { data: openDisputes } = await supabase
     .from("disputes")
     .select("id")
     .eq("event_id", eventId)
     .in("state", ["Open", "UnderReview"]);
   if (openDisputes?.length > 0) throw new Error("Blocked by unresolved disputes");
   ```
2. **Escrow Balance & State Verification**:
   Query `escrow_accounts` to ensure `status === 'Funded' || status === 'Verified' || status === 'FullyFunded'`.
   Query on-chain Soroban contract balance via `queryEscrowState()` to ensure contract balance matches or exceeds target stroops.

#### Step 2: DB Optimistic Concurrency Lock (Replay Prevention)
To prevent dual execution if webhook and cron fire simultaneously:
```ts
const { data: updated, error } = await supabase
  .from("events")
  .update({ state: "EscrowRelease", version: event.version + 1, updated_at: new Date().toISOString() })
  .eq("id", eventId)
  .eq("state", "PrizeApproved")
  .eq("version", event.version)
  .select()
  .single();

if (error || !updated) {
  logger.warn("[escrow-trigger] Concurrent execution aborted or state already transitioned", { eventId });
  return;
}
```

#### Step 3: Soroban Contract Lock (`lockEscrow`)
Lock the contract on-chain to prevent any further deposits and prepare for disbursement:
```ts
const lockResult = await lockEscrow({
  platformSecretKey: process.env.STELLAR_ESCROW_SECRET!,
  contractId: escrow.contract_address,
});
if (!lockResult.success) {
  throw new Error(`Failed to lock Soroban escrow: ${lockResult.error}`);
}
```

#### Step 4: Soroban Batch Payout (`executeSorobanDisbursementBatch`)
Fetch verified winner wallets and prize amounts. Convert amounts to stroops (`1 XLM = 10,000,000 stroops` or token decimals):
```ts
// Group into batches of up to 100 recipients
for (const batch of recipientBatches) {
  const disburseResult = await executeSorobanDisbursementBatch({
    recipients: batch.recipients, // Array of G... public keys
    amounts: batch.amounts,       // Array of BigInt (stroops)
    platformSecretKey: process.env.STELLAR_ESCROW_SECRET!,
    contractId: escrow.contract_address,
  });

  if (!disburseResult.success || !disburseResult.txHash) {
    throw new Error(`Soroban batch payout failed: ${disburseResult.error}`);
  }

  // Record tx_hash for each payout instruction
  await updateInstructionTxHashes(batch.instructionIds, disburseResult.txHash);
}
```

#### Step 5: Soroban Contract Finalization (`finalizeDisbursement`)
Transition smart contract state to `Released (4)`:
```ts
const finalizeResult = await finalizeDisbursement({
  platformSecretKey: process.env.STELLAR_ESCROW_SECRET!,
  contractId: escrow.contract_address,
});
```

#### Step 6: Reconciliation & Audit Logging
Update DB `escrow_accounts.status = 'Completed'` and write audit record (`writeAuditRecord`):
```ts
await writeAuditRecord({
  action: "escrow.soroban_disbursement_completed",
  actor_id: "system",
  event_id: eventId,
  resource_type: "escrow_accounts",
  resource_id: escrow.id,
  metadata: {
    contract_address: escrow.contract_address,
    tx_hashes: recordedTxHashes,
    recipients_count: totalRecipients,
  },
});
```

---

## 5. Failure Recovery, Idempotency & Safety Matrix

| Scenario | Risk | Mitigation Mechanism |
|---|---|---|
| **Webhook & Cron fire simultaneously** | Double payout | Optimistic locking on `events.version` (`eq("state", "PrizeApproved").eq("version", event.version)`). Second caller fails gracefully. |
| **Soroban RPC temporary timeout** | Tx status unconfirmed | `pollForConfirmation()` polls tx status up to 30 attempts with exponential backoff before throwing retryable error. |
| **Contract already locked on-chain** | `lockEscrow()` error | `lockEscrow` error handler checks `queryEscrowState()`; if `isLocked === true`, proceeds to disbursement. |
| **Unverified winner wallet** | Transaction rejection | Unverified winners are placed in `held` status; remaining verified winners proceed in payout batch. |
| **Partial batch failure** | Incomplete payout | Batch idempotency keys (`payout_batches.idempotency_key`) prevent re-executing completed batches. Retry worker retries only `Pending` / `Retry` instructions. |

---

## 6. Summary of Code Locations & Artifacts

- **Soroban Smart Contract**: `contracts/escrow/src/lib.rs` (lines 185-336)
- **Soroban Integration Client**: `web/lib/stellar/soroban-escrow.ts` (lines 269-369)
- **Cron Trigger Route**: `web/app/api/cron/escrow/route.ts` (lines 30-155)
- **Domain Service**: `web/src/domains/escrow/services/EscrowService.ts` (lines 257-374)
- **State Transition Route**: `web/app/api/events/[id]/state/route.ts` (lines 40-238)
- **Database Migrations**: `web/supabase/migrations/20250101000048_module8_escrow_domain.sql`
