# Handoff Report: Requirement 3 — Automated Escrow Trigger (Soroban On-Chain Payout)

## 1. Observation

### Direct Observations & Code Evidence:
- **Soroban Smart Contract (`contracts/escrow/src/lib.rs`)**:
  - `lock(env)` (lines 185–205): Requires `state == EscrowState::FullyFunded`, admin auth, and transitions contract state to `Locked (3)`.
  - `disburse_batch(env, recipients: Vec<Address>, amounts: Vec<i128>)` (lines 210–261): Requires `state == EscrowState::Locked`, transfers tokens from contract to recipients, updates balance, keeps state as `Locked`.
  - `finalize(env)` (lines 320–336): Requires `state == EscrowState::Locked`, transitions state to `Released (4)`.
  - `deposit` & `admin_deposit` (lines 99–182): Handles funding by organizer and sponsors.

- **Soroban Integration Client (`web/lib/stellar/soroban-escrow.ts`)**:
  - `lockEscrow` (lines 269–293): Builds and submits `lock` invocation to Soroban RPC.
  - `executeSorobanDisbursementBatch` (lines 301–337): Assembles `disburse_batch` call, converts `recipients` to ScVal vector and `amounts` to `i128` ScVal vector, simulates, signs with platform keypair, submits to Soroban RPC, and polls for confirmation.
  - `finalizeDisbursement` (lines 345–369): Assembles and submits `finalize` call to Soroban RPC.
  - `queryEscrowState` (lines 409–484): Simulates read-only calls (`get_balance`, `get_state`, `is_locked`, `get_target`, `get_disbursed_total`).

- **Escrow Automation Cron Route (`web/app/api/cron/escrow/route.ts`)**:
  - Finds events in `PrizeApproved` state (line 46).
  - Checks for unresolved disputes (lines 54–65).
  - Verifies `escrow.state === 'FullyFunded'` (lines 68–79).
  - Updates `events.state` to `EscrowRelease` with optimistic concurrency (`version + 1`) (lines 84–93).
  - Calls `service.generatePayoutBatch` and `service.executePayoutBatch` (lines 115–130).

- **State Transition Route (`web/app/api/events/[id]/state/route.ts`)**:
  - Validates `target_state` transition via `EventWorkflowEngine` (lines 187–205).
  - Updates `events.state` in database with version increment (lines 208–218).

- **Architecture Decisions (`docs/adr/001-escrow-architecture.md` & `docs/adr/001-horizon-soroban-dual-layer.md`)**:
  - Outlines dual-layer design (Horizon execution vs. Soroban state tracking).
  - Outlines Phase 4 path to full Soroban on-chain execution using `disburse_batch` and `finalize`.

---

## 2. Logic Chain

1. **Observation 1**: The user requirement for Requirement 3 specifies: "Create an automated background job or API webhook endpoint that watches for the `PrizeApproved` state to automatically trigger the on-chain payout via the existing Soroban contracts, removing the need for manual platform intervention."
2. **Observation 2**: The smart contract `contracts/escrow/src/lib.rs` provides `lock()`, `disburse_batch()`, and `finalize()`, and `web/lib/stellar/soroban-escrow.ts` provides complete TypeScript functions (`lockEscrow`, `executeSorobanDisbursementBatch`, `finalizeDisbursement`) to execute these functions over Soroban RPC.
3. **Observation 3**: `web/app/api/cron/escrow/route.ts` already implements the detection of `PrizeApproved` state, dispute checks (`disputes.state IN ('Open', 'UnderReview')`), funding verification (`escrow.state === 'FullyFunded'`), optimistic locking (`state = 'EscrowRelease'`, `version + 1`), and batch payout invocation.
4. **Observation 4**: Currently, `web/app/api/cron/escrow/route.ts` calls `EscrowService` which delegates execution to `StellarEscrowAdapter` (Horizon native payments).
5. **Deduction & Synthesis**: To fully satisfy Requirement 3, the automated trigger pipeline (`web/app/api/cron/escrow/route.ts` or dedicated webhook route `/api/webhooks/escrow-trigger`) must bridge directly to `soroban-escrow.ts` functions (`lockEscrow()` -> `executeSorobanDisbursementBatch()` -> `finalizeDisbursement()`).
6. **Safety & Concurrency Logic**:
   - Optimistic concurrency on `events.version` prevents double execution if cron and webhook fire simultaneously.
   - Batch idempotency key (`prize_allocation_batch_id`) passed to `generate_payout_batch` prevents duplicate instruction creation.
   - On-chain contract locking (`lockEscrow`) ensures no new deposits are accepted during payout.
   - Recording Soroban transaction hashes (`txHash`) into `payout_instructions` and `transactions` ensures full on-chain auditability.

---

## 3. Caveats

- **Network Mode**: Soroban RPC calls rely on `SOROBAN_RPC_URL` (default: `https://soroban-testnet.stellar.org`). Testnet RPC endpoints can occasionally experience rate limits or latency; proper transaction polling (`pollForConfirmation`) with retries is essential.
- **KMS Secret Storage**: In production mainnet, platform secrets must be loaded via envelope KMS encryption (`decryptSecret`), rather than plain environment variables.
- **Dual-Layer Reconciliation**: If Horizon payments were previously used, existing test escrows may have state discrepancies between database status and Soroban contract storage (`queryEscrowState`). Reconciliation scripts should verify contract initialization before triggering `lockEscrow`.

---

## 4. Conclusion

Requirement 3 can be satisfied cleanly by wiring the automated state watcher (`web/app/api/cron/escrow/route.ts` and/or a Supabase DB Webhook handler `POST /api/webhooks/escrow-trigger`) directly to the Soroban execution pipeline in `web/lib/stellar/soroban-escrow.ts`.

### Concrete Architecture Components:
1. **Trigger Component**: Next.js Webhook endpoint `POST /api/webhooks/escrow-trigger` (fired immediately when `events.state` reaches `PrizeApproved`) and periodic Cron `POST /api/cron/escrow` (as a fallback/resilience polling worker).
2. **Safety Gates**: Dispute check (`disputes`), funding check (`escrow_accounts`), and optimistic DB update (`events.version`).
3. **Soroban Execution Adapter**: Calls `lockEscrow()`, iterates batches with `executeSorobanDisbursementBatch()`, and concludes with `finalizeDisbursement()`.
4. **Audit & Persistence**: Stores Soroban transaction hashes in `payout_instructions.tx_hash` and publishes `PrizeReleased` domain event.

---

## 5. Verification Method

To verify the implementation once created:

1. **Unit & Integration Test Inspection**:
   Run Vitest test suite for escrow integration:
   ```bash
   npx vitest run web/lib/services/escrow/__tests__/escrow.integration.test.ts
   ```
2. **Soroban Smart Contract Verification**:
   Inspect cargo test suite for contract lifecycle:
   ```bash
   cd contracts/escrow && cargo test
   ```
3. **Database & API Route Verification**:
   - Inspect `web/app/api/cron/escrow/route.ts` to confirm `state = 'PrizeApproved'` query and Soroban adapter invocation.
   - Inspect `web/lib/stellar/soroban-escrow.ts` for `lockEscrow`, `executeSorobanDisbursementBatch`, and `finalizeDisbursement`.
