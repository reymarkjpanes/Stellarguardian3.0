# Financial & Blockchain Audit — StellarGuardian 3.0

## 1. Critical Financial Findings

### 🔴 Transaction Signing Not Implemented

**Location**: `lib/services/escrow/disbursement.service.ts` + `lib/stellar/client.ts`

**Flow**:
1. `buildPaymentBatch()` returns unsigned XDR
2. `submitSignedTx()` expects signed XDR
3. No code exists to decrypt the escrow keypair and sign between these steps

**Impact**: Every disbursement attempt will fail. This is the most critical blocker for the financial workflow.

**Required Fix**:
```typescript
// After buildPaymentBatch:
const escrowSecret = await decryptSecret(escrow.encrypted_secret_key);
const keypair = Keypair.fromSecret(escrowSecret);
const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
tx.sign(keypair);
const signedXdr = tx.toXDR();
// Then submit signedXdr
```

---

### 🔴 No Transaction Boundaries

**Issue**: Financial operations (fund, disburse, refund) perform multiple database writes without transactions:

1. Update escrow state
2. Insert transaction record
3. Write audit record
4. Create notification

If step 2 fails after step 1 succeeds, the system is in an inconsistent state.

**Mitigation**: Supabase RPCs (`fund_escrow`, `disburse_prizes`) handle some transactional logic, but the TypeScript services don't wrap their multi-step operations in database transactions.

---

### 🔴 Duplicate Escrow Schema

Two migrations create conflicting `escrow_accounts` tables:
- **Migration 000005** (`escrow_and_transactions.sql`): Creates `escrow_accounts` with 9 states
- **Migration 000048** (`module8_escrow_domain.sql`): DROPs and recreates `escrow_accounts` with PostgreSQL ENUM type and different columns

**Impact**: The final schema depends on migration execution order. The code in `lib/services/escrow/` references columns from migration 000005, but if migration 000048 runs, those columns don't exist.

---

## 2. Prize Allocation Integrity

### Validation Chain

| Check | Implemented | Location |
|-------|------------|----------|
| `sum(prizes) <= confirmedOnChainBalance` | ✅ | `DisbursementService.validatePrizeAllocation()` |
| Individual allocation amounts are positive | ✅ | DB CHECK constraint (`amount > 0`) |
| Total allocations match prize pool target | ⚠️ Partial | `src/domains/prizes/` has batch validation |
| No duplicate allocations for same winner | ⚠️ | No unique constraint on (event_id, recipient_id) in winners table |
| Allocation amounts use consistent precision | ❌ | `numeric` type without precision — floating point risk |

### Issues

1. 🟠 **No precision defined on `numeric` columns** — Stellar uses 7 decimal places (stroops). The DB should use `numeric(20,7)` to prevent precision loss.
2. 🟡 **Rounding not addressed** — When splitting a prize pool, remainders from rounding could accumulate.
3. 🟡 **No fee accounting** — Stellar transaction fees are deducted from the source account but not tracked in the `expected_balance`.

---

## 3. Escrow Balance Tracking

### Reconciliation Flow

```
On every escrow transition:
  1. stellar.getBalance(escrow.stellar_public_key) → on-chain balance
  2. Compare against escrow.expected_balance
  3. If mismatch → flag inconsistent, notify admin, block automated transitions
```

✅ Well-designed reconciliation pattern.

### Issues

1. 🟠 **Reconciliation is not scheduled** — It only runs on transition attempts. If no one tries to transition, drift goes undetected.
2. 🟡 **No cron job for periodic reconciliation** — `/api/cron/` directory exists but no reconciliation job found.
3. 🟡 **`expected_balance` updated manually** — If `FundingService.verifyFunding()` uses `stellar.getBalance()` as the new expected balance, a concurrent deposit could create false consistency.

---

## 4. Idempotency Assessment

### Implementation Quality: ✅ Good

| Requirement | Status |
|-------------|--------|
| DB unique constraint on key | ✅ Prevents races |
| SHA-256 body hash comparison | ✅ Detects same-key-different-body |
| 409 on conflict (Req 13.4) | ✅ |
| Stored response replay (Req 13.2) | ✅ |
| 24-hour TTL (Req 13.3) | ✅ |
| Race condition handling (23505) | ✅ |

### Issue

1. 🟡 **TTL not enforced automatically** — No cron job or Supabase trigger to clean expired keys. Over time the table will grow unbounded.

---

## 5. Refund Workflow Assessment

### Implementation Quality: ✅ Good Design

| Requirement | Status |
|-------------|--------|
| Max 3 retries (Req 9.4) | ✅ `MAX_REFUND_RETRIES = 3` |
| Exponential backoff | ✅ `1000 * 2^(attempt-1)` ms |
| Refund to original funding wallet (Req 9.1) | ✅ Uses `escrow.funding_wallet` |
| On failure: state → Failed + notification | ✅ |
| Partial refund computation | ⚠️ Not implemented — always refunds full balance |

### Issues

1. 🟠 **No partial refund support** — If some winners have been disbursed, the refund sends the full remaining balance. But `RefundService` doesn't verify which winners were already paid.
2. 🟠 **Same signing gap** — `buildPaymentBatch` returns unsigned XDR for refund too.
3. 🟡 **Backoff is very short** — 1s, 2s, 4s — Stellar transaction finality can take 5-10 seconds. A failed tx might succeed on-chain after the retry window.

---

## 6. Soroban Smart Contract Integration

### Implemented Operations

| Operation | Function | Status |
|-----------|----------|--------|
| Initialize escrow | `initializeEscrow()` | ✅ Working pattern |
| Build deposit XDR | `buildDepositTransaction()` | ✅ Returns unsigned XDR for Freighter |
| Execute disbursement | `executeSorobanDisbursement()` | ✅ Platform signs with keypair |
| Execute refund | `executeSorobanRefund()` | ✅ Platform signs |
| Query state | `queryEscrowState()` | 🔴 Returns hardcoded zeros |
| Poll transaction | `pollTransaction()` | ✅ 30 attempts × 2s |

### Critical Issue

```typescript
// queryEscrowState() - hardcoded return values
return {
  balance: balanceResult?.retval ? BigInt(0) : BigInt(0), // Always 0!
  state: stateResult?.retval ? 0 : 0, // Always 0!
  isLocked: false, // Always false!
};
```

**Impact**: Any code relying on `queryEscrowState()` will always see balance=0, state=0 (PendingFunding), unlocked — regardless of actual contract state.

---

## 7. Dual Escrow Architecture (Horizon vs. Soroban)

The project has TWO escrow implementations:

| Aspect | Horizon-based (`lib/stellar/client.ts`) | Soroban-based (`lib/stellar/soroban-escrow.ts`) |
|--------|----------------------------------------|------------------------------------------------|
| Key management | Platform-custodied keypair | Platform signs contract invocations |
| Disbursement | `buildPaymentBatch` (payment ops) | `disburse` contract method |
| Refund | Payment from escrow → funder | `refund` contract method |
| State query | `getBalance` (Horizon API) | `get_state` (Soroban simulation) |
| Locking | Not implemented | `lock()` contract method |

**Issue**: It's unclear which path is canonical. The services in `lib/services/escrow/` use the Horizon-based adapter, but `soroban-escrow.ts` exists as a parallel implementation. This needs a clear decision:
- **Horizon path**: Simpler but less trustless (platform holds the key)
- **Soroban path**: Trustless (contract enforces rules) but more complex

---

## 8. Fee Accounting

| Fee Type | Tracked? | Impact |
|----------|----------|--------|
| Stellar base fee (100 stroops/op) | ❌ | Deducted from escrow balance but not from `expected_balance` |
| Network surge pricing | ❌ | Could cause fee > budgeted amount |
| Account creation reserve (1 XLM) | ❌ | Escrow account needs min balance |
| Claimable balance reserve | ❌ | If used for held winners |

**Impact**: After many transactions, `expected_balance` will drift from actual on-chain balance due to accumulated fees, triggering false inconsistency flags.

---

## 9. Settlement Audit Trail

### Implemented

- ✅ `writeAuditRecord` called on every financial operation
- ✅ Audit records include: action, actor_id, event_id, resource_type, tx_hash, wallet_address, amount
- ✅ Audit records are append-only (DB triggers block UPDATE/DELETE)
- ✅ `on_chain_status` field tracks confirmation

### Missing

1. 🟡 **No settlement report generation** — The `settlements` table exists (Module 8) but no service populates it
2. 🟡 **No reconciliation history** — Each reconciliation overwrites `last_reconciled_balance` instead of appending to a history table
3. 🟡 **No export endpoint** — Design mentions CSV/JSON export (Req 31.4-31.5) but no implementation found

---

## 10. Recommendations

### Immediate Blockers

1. **Implement transaction signing** — Decrypt escrow key, sign XDR, then submit
2. **Choose one escrow path** — Horizon OR Soroban, not both
3. **Resolve migration conflict** — Either remove Module 8 migration or adapt services to its schema
4. **Add numeric precision** — Use `numeric(20,7)` for all financial columns

### Short-Term

5. **Implement periodic reconciliation** — Cron job every 15 minutes for funded escrows
6. **Add fee accounting** — Deduct estimated fees from expected balance on each operation
7. **Fix `queryEscrowState()`** — Parse Soroban ScVal responses properly
8. **Add partial refund logic** — Calculate remaining balance minus confirmed disbursements
9. **Implement idempotency key cleanup** — Cron job to delete expired keys
10. **Add settlement service** — Record final settlement when escrow reaches Released/Refunded terminal state
