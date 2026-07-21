# Stellar Guardian 3.0 — Comprehensive Remediation & Production Readiness Blueprint

**Document Version**: 1.0
**Created**: July 21, 2026
**Based on**: FULL_PRODUCTION_AUDIT.md (Score: 52/100)
**Target Score**: 85+/100 (Production Ready)
**Estimated Duration**: 10 weeks (7 phases)

---

## Executive Summary

This document is the complete engineering blueprint to transform Stellar Guardian 3.0 from Early Beta (52/100) to Production Ready (85+). It addresses every finding from the full audit across security, financial integrity, blockchain consistency, UI/UX completeness, and infrastructure.

**Core Problems Requiring Resolution**:
1. Financial double-spend vulnerability (no disbursement mutex)
2. Missing security infrastructure (rate limiting, MFA, CAPTCHA)
3. Soroban contract/backend state mismatch (6 vs 9 states, deposit auth)
4. Missing user-facing pages (signup, admin, workspace creation)
5. Incomplete permission system (3/10 roles defined)
6. No database transaction boundaries on financial operations
7. Insufficient test coverage for financial platform (~20 files)

**Approach**: Fix from the inside out — database/security first, then services, then API, then UI. Each phase has clear acceptance criteria and can be validated independently.

---

## Part 1: Root Cause Analysis

### RCA-1: Double-Disbursement Race Condition

**Problem**: Two concurrent calls to `DisbursementService.executeDisbursement()` can both read `pending` winners and submit separate on-chain transactions, paying winners twice.

**Root Cause**: The service uses a read-then-write pattern without any locking mechanism. The decision to keep services stateless (good for horizontal scaling) inadvertently removed the coordination layer needed for financial atomicity.

**Architectural Origin**: The `disbursement.service.ts` was designed as a pure function call without considering that multiple API requests could invoke it simultaneously. The existing `idempotency_keys` table was built for HTTP-level deduplication but never wired into disbursement.

**Affected Modules**: `disbursement.service.ts`, `winners` table, `transactions` table, escrow state machine

**Impacted Roles**: Organizer (triggers disbursement), Participant/Winner (receives double payment)

**Business Impact**: 🔴 Financial loss — escrow drained beyond prize allocation

**Security Impact**: 🔴 Exploitable — malicious actor with organizer access could deliberately trigger concurrent requests

**Blockchain Impact**: 🔴 On-chain transactions are irreversible — double-paid funds cannot be recovered without recipient cooperation

---

### RCA-2: No Rate Limiting

**Problem**: Every endpoint is unprotected against brute-force attacks, credential stuffing, and API abuse.

**Root Cause**: Rate limiting was explicitly removed during development (comment in `middleware.ts`: "Re-add it with proper Redis backing before production"). The team deferred this to avoid needing Redis infrastructure during development.

**Architectural Origin**: The middleware pipeline was designed with a rate-limiting slot (the comment proves intent) but no implementation was provided. The decision to use Supabase (serverless) means there's no persistent in-process state for token buckets — external state (Redis/KV) is required.

**Affected Modules**: `middleware.ts`, all API routes, auth endpoints

**Impacted Roles**: All — especially auth endpoints (login, signup)

**Business Impact**: 🟠 Service degradation, potential account takeover

**Security Impact**: 🔴 Critical — brute-force login, API scraping, DDoS amplification

---

### RCA-3: Soroban Contract State Mismatch

**Problem**: The Soroban escrow contract has 6 states; the backend has 9; deposit authorization differs (contract: organizer-only; backend: any wallet).

**Root Cause**: The contract and backend were developed in parallel without a shared specification. The contract was written as a minimal viable escrow (good Soroban practice — small, auditable), while the backend evolved to handle more complex scenarios (sponsor deposits, reconciliation states like `Failed`, `Cancelled`).

**Architectural Origin**: Dual-architecture decision — the backend uses Horizon API for actual fund transfers (direct Stellar payments) while the Soroban contract exists as a separate state-tracking mechanism. They don't communicate at runtime. This creates a "dual-truth" where on-chain state and DB state can diverge.

**Affected Modules**: `soroban-escrow.ts`, `contracts/escrow/src/lib.rs`, `state-machine/escrow.ts`, `funding.service.ts`

**Business Impact**: 🟠 Funds could be on-chain in one state while the DB shows another

**Blockchain Impact**: 🔴 The contract's deposit restriction prevents the sponsor funding use case that the backend supports

---

### RCA-4: No Database Transaction Boundaries

**Problem**: Financial operations (fund, disburse, refund) perform multiple DB writes sequentially without wrapping them in a transaction. Partial failure leaves inconsistent state.

**Root Cause**: Supabase's JavaScript client does not natively support multi-statement transactions from the client SDK. The team used Supabase RPCs for some operations (e.g., `fund_escrow`) but the TypeScript service layer above them doesn't coordinate multiple RPC calls atomically.

**Architectural Origin**: The decision to use Supabase as the database layer provides excellent DX but limits transaction control. PostgreSQL transactions require either raw SQL (via `supabase.rpc()`) or a direct connection (not available in serverless Next.js without connection pooling).

**Affected Modules**: `funding.service.ts`, `disbursement.service.ts`, `refund.service.ts`, all repository methods

**Business Impact**: 🔴 Escrow state and transaction records can become inconsistent

---

### RCA-5: Permission Engine Incompleteness

**Problem**: `PermissionEngine` defines RBAC/ABAC rules for only 3 of 10 platform roles. The remaining 7 roles have no rules, causing `PermissionEngine.can()` to return `false` for everything.

**Root Cause**: The PermissionEngine was designed as the replacement for the legacy `requireEventRole`/`requireWorkspaceRole` helpers, but the migration was never completed. Both systems coexist, with different route handlers using different systems.

**Architectural Origin**: An incomplete refactoring — the engine was built with the correct interface but the permission matrix was never populated. The legacy system continues to function (hiding the gap), so there was no visible breakage to force completion.

**Affected Modules**: `permission-engine.ts`, `authorize.ts`, all route handlers

**Impacted Roles**: WorkspaceOwner, WorkspaceAdmin, Sponsor, Mentor, Participant, TeamCaptain, TeamMember

---

### RCA-6: Missing User-Facing Pages

**Problem**: Signup, workspace creation, admin dashboard, terms, and privacy pages are referenced in navigation but don't exist.

**Root Cause**: Development prioritized the complex financial/event workflows over basic platform pages. The assumption was that Supabase Auth UI could handle signup, but the project uses custom login — so a custom signup page is also needed.

**Architectural Origin**: The route structure was planned (links exist in navigation) but page implementation was deferred. The `(auth)` route group only contains `login/page.tsx`, `forgot-password/page.tsx`, and `reset-password/page.tsx`.

**Impacted Roles**: All new users (cannot register), all authenticated users (broken footer links), Platform Admin (no admin tools)

---

### RCA-7: Wallet Removal Without Active-Escrow Check

**Problem**: A user can remove their verified wallet from settings while they're a pending winner in an active event, causing their prize to be "held" during disbursement.

**Root Cause**: The wallet removal endpoint (`DELETE` on `wallets` table via Supabase client) has no server-side business rule check. The settings page handles this purely as a CRUD operation without consulting the `winners` table.

**Architectural Origin**: Wallet management was built as a standalone feature without considering its downstream dependencies in the escrow workflow. The "held" status in disbursement handles the absence gracefully (no crash), but the UX is confusing — the user doesn't know they'll miss their prize.

---

---

## Part 2: Complete Issue Resolution Plan

---

### Issue C1: Double-Disbursement Race Condition

**Problem**: Concurrent disbursement calls can pay winners twice.

**Risks if Unfixed**: Financial loss, escrow overdraft, legal liability, loss of platform trust.

**Recommended Solution**: PostgreSQL advisory lock + status transition guard.

```sql
-- New Supabase RPC: begin_disbursement
CREATE OR REPLACE FUNCTION begin_disbursement(p_event_id uuid, p_actor_id uuid)
RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  v_lock_acquired boolean;
BEGIN
  -- Attempt advisory lock keyed on event_id (non-blocking)
  SELECT pg_try_advisory_xact_lock(hashtext(p_event_id::text)) INTO v_lock_acquired;
  IF NOT v_lock_acquired THEN
    RETURN false; -- Another disbursement is in progress
  END IF;

  -- Transition escrow to PendingRelease (guards against re-entry)
  UPDATE escrow_accounts
  SET state = 'PendingRelease', version = version + 1
  WHERE event_id = p_event_id AND state IN ('Locked', 'FullyFunded')
  RETURNING id INTO v_lock_acquired; -- reuse variable

  IF NOT FOUND THEN
    RETURN false; -- Invalid state for disbursement
  END IF;

  RETURN true;
END;
$$;
```

**Implementation**:
1. Create migration `20250101000014_disbursement_lock.sql` with the RPC above
2. Modify `DisbursementService.executeDisbursement()`:
   - Call `supabase.rpc('begin_disbursement', { p_event_id, p_actor_id })` first
   - If returns `false`, throw `ConflictError("Disbursement already in progress")`
   - On success, proceed with payment batch
   - On failure, call `supabase.rpc('abort_disbursement', { p_event_id })` to reset state
3. Add corresponding `abort_disbursement` and `complete_disbursement` RPCs

**Alternative Solutions**:
- Redis distributed lock (SETNX): Requires new infrastructure dependency. Rejected — Postgres advisory locks are sufficient and already available.
- Optimistic locking on winners table: Would require checking every winner's version. More complex, still has TOCTOU window. Rejected.
- Queue-based disbursement: Best long-term but requires message queue infrastructure not in current stack. Deferred to Phase 5.

**Acceptance Criteria**:
- [ ] Concurrent disbursement calls return 409 Conflict for the second caller
- [ ] No double payments possible even under load test (100 concurrent requests)
- [ ] Escrow state transitions atomically within the lock
- [ ] Failed disbursement correctly resets escrow state to previous value
- [ ] Integration test proves mutual exclusion

---

### Issue C2: No Rate Limiting

**Problem**: All endpoints vulnerable to brute-force and abuse.

**Risks if Unfixed**: Account takeover, API abuse, service degradation, resource exhaustion.

**Recommended Solution**: Upstash Redis rate limiting via middleware.

**Required Changes**:
- Add `@upstash/ratelimit` and `@upstash/redis` dependencies
- Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to env
- Implement tiered rate limits in middleware:

| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| `/api/auth/*` | 5 req | 60s per IP |
| `/api/events/*/disburse` | 2 req | 300s per user |
| `/api/events/*/fund` | 5 req | 60s per user |
| `/api/events` (POST) | 10 req | 60s per user |
| `/api/*` (general) | 60 req | 60s per user |
| `/api/*` (unauthenticated) | 30 req | 60s per IP |

**Implementation**:
1. Add to `package.json`: `"@upstash/ratelimit": "^2.0.0"`, `"@upstash/redis": "^1.34.0"`
2. Create `web/lib/rate-limit.ts` with tiered limiter factory
3. Integrate into `middleware.ts` after auth check, before route forwarding
4. Return standard `429 Too Many Requests` with `Retry-After` header

**Alternative Solutions**:
- Vercel Edge Config rate limiting: Tied to Vercel deployment. Rejected — platform-agnostic is better.
- In-memory Map (per-instance): Won't work with multiple serverless instances. Rejected.
- Cloudflare rate limiting: External dependency on CDN. Rejected — code-level is more controllable.

**Acceptance Criteria**:
- [ ] Auth endpoints reject after 5 failed attempts per minute per IP
- [ ] Financial endpoints (disburse, fund, refund) limited to 2/5min per user
- [ ] 429 response includes `Retry-After` header
- [ ] Rate limit state survives serverless cold starts (Redis-backed)
- [ ] Rate limit bypass for health check endpoints


---

### Issue C3: Missing Signup Page

**Problem**: Users cannot create accounts — no `/signup` page exists.

**Risks if Unfixed**: Platform unusable for new users. Complete onboarding blocker.

**Recommended Solution**: Create `web/app/(auth)/signup/page.tsx` mirroring login structure with: email, password, confirm password, display name, terms acceptance.

**Required Changes**:
- Create `web/app/(auth)/signup/page.tsx` (client component)
- Wire Supabase `auth.signUp()` with email confirmation
- Add display_name to user_metadata during signup
- Add terms acceptance checkbox with link to `/terms`
- Redirect to `/dashboard` after email confirmation callback
- Add `web/app/(auth)/layout.tsx` for shared auth page layout (centered card)

**Acceptance Criteria**:
- [ ] New users can register with email/password
- [ ] Display name captured at registration
- [ ] Email confirmation sent and required before login
- [ ] Terms acceptance stored in user metadata
- [ ] Duplicate email shows clear error
- [ ] Password strength requirements enforced (min 8 chars)
- [ ] Page uses CSS variables (supports dark mode)
- [ ] Mobile-responsive layout

---

### Issue C4: Soroban Contract Partial-Disburse Bug

**Problem**: `disburse()` transitions to `Released` after first call. Multi-batch disbursement (>100 winners) impossible on-chain.

**Risks if Unfixed**: Events with >100 winners cannot complete prize distribution via the Soroban contract.

**Recommended Solution**: Redesign the contract to support partial disbursement with a cumulative counter.

**Contract Changes** (Rust):
```rust
// Add new DataKey
DataKey::DisbursedTotal,  // i128 - cumulative amount disbursed

// Modify disburse() to NOT transition to Released
pub fn disburse(env: Env, recipients: Vec<Address>, amounts: Vec<i128>) {
    // ... existing auth + state checks ...
    // Transfer loop stays the same
    // Update DisbursedTotal instead of Balance
    let disbursed_total: i128 = env.storage().instance()
        .get(&DataKey::DisbursedTotal).unwrap_or(0);
    env.storage().instance()
        .set(&DataKey::DisbursedTotal, &(disbursed_total + total_disbursed));
    // DON'T change state here
}

// New method: finalize_disbursement — called after all batches
pub fn finalize(env: Env) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
    let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
    assert!(state == EscrowState::Locked, "Must be locked to finalize");
    env.storage().instance().set(&DataKey::State, &EscrowState::Released);
}
```

**Alternative Solutions**:
- Keep contract as-is, only use Horizon for transfers: This is what the backend already does. The contract becomes state-tracking only. Simpler but reduces the contract to a glorified counter. **Chosen for Phase 1** — minimal contract changes, fix the partial-disburse issue in Phase 4 when contract is audited.
- Deploy a new contract per event: Expensive, but isolates state perfectly. Good for Phase 4.

**Phase 1 Decision**: Accept that the Soroban contract is a state-tracking complement, not the execution layer. The backend uses Horizon for actual transfers. Document this architectural decision. Fix the contract in Phase 4 for full on-chain execution.

**Acceptance Criteria**:
- [ ] Backend disbursement works with >100 winners (batched via Horizon)
- [ ] Contract state accurately reflects post-disbursement reality
- [ ] Documentation clearly states Horizon is the execution layer, Soroban is tracking
- [ ] Phase 4 ADR written for full Soroban execution migration

---

### Issue C5: Backend/Contract State Mismatch

**Problem**: 9 backend states vs 6 contract states; different deposit auth models.

**Recommended Solution**: Accept the architectural divergence and formalize it as a design decision.

**Rationale**: The backend legitimately needs states the contract doesn't:
- `Failed`: Recovery state after transaction failure (backend-only concern)
- `Cancelled`: Event cancellation workflow (backend triggers refund, contract goes to `Refunded`)
- `PendingRelease`: Disbursement-in-progress lock (backend mutex, not on-chain)

Create a **state mapping document** and a **synchronization service**:

| Backend State | Contract State | Sync Action |
|--------------|---------------|-------------|
| PendingFunding | PendingFunding (0) | Direct map |
| PartiallyFunded | PartiallyFunded (1) | Direct map |
| FullyFunded | FullyFunded (2) | Direct map |
| Locked | Locked (3) | Call `contract.lock()` |
| PendingRelease | Locked (3) | No contract change (backend-only) |
| Released | Released (4) | Call `contract.finalize()` after batches |
| Refunded | Refunded (5) | Call `contract.refund()` |
| Failed | N/A | Backend-only, no contract equivalent |
| Cancelled | Refunded (5) | Trigger refund flow then map |

**Acceptance Criteria**:
- [ ] ADR (Architecture Decision Record) documents the dual-layer approach
- [ ] State mapping table in code as a constant (`BACKEND_TO_CONTRACT_STATE_MAP`)
- [ ] `VerificationService.reconcileEscrow()` compares both states and flags divergence
- [ ] Contract `get_state()` queried during reconciliation


---

### Issue C6: Deposit Auth Mismatch (Contract vs Backend)

**Problem**: Contract only allows organizer to deposit; backend allows any wallet (sponsors).

**Recommended Solution**: For Phase 1, accept Horizon-only deposits (bypasses contract). For Phase 4, add `admin_deposit` method to contract.

**Implementation (Phase 1)**:
- Document that deposits go directly to the escrow Stellar public key via standard Horizon payments
- The contract's `deposit()` method is not called by the backend
- Reconciliation service verifies the on-chain balance matches the backend's tracked deposits
- This is already how the system works — just formalize it

**Implementation (Phase 4)**:
```rust
/// Admin-authorized deposit from any address (sponsor use case)
pub fn admin_deposit(env: Env, from: Address, amount: i128) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth(); // Platform authorizes the deposit
    from.require_auth();  // Sender confirms the transfer
    // ... same token transfer and state update logic as deposit()
}
```

**Acceptance Criteria**:
- [ ] Sponsor deposits work end-to-end via Horizon direct transfer
- [ ] Backend tracks deposits from any verified wallet in `transactions` table
- [ ] Reconciliation confirms on-chain balance matches sum of confirmed deposits
- [ ] Documentation notes that contract deposit method is unused in current flow

---

### Issue C7: No MFA for Financial Operations

**Problem**: Mainnet disbursement/refund can be triggered with only a session token — no additional verification.

**Recommended Solution**: Supabase MFA (TOTP) enforcement for financial endpoints.

**Implementation**:
1. Enable MFA in Supabase Auth configuration
2. Add MFA enrollment flow in Settings page (QR code + backup codes)
3. Create middleware check for financial endpoints:
```typescript
// In apiHandler or a dedicated decorator
if (isFinancialOperation(request.url) && networkMode === 'mainnet') {
  const { data: { currentLevel } } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (currentLevel !== 'aal2') {
    throw new ForbiddenError('MFA verification required for mainnet financial operations.');
  }
}
```
4. Financial endpoints that require MFA: `/api/events/[id]/disburse`, `/api/events/[id]/refund`, `/api/events/[id]/fund` (mainnet only)

**Alternative Solutions**:
- Email OTP for each financial operation: Higher friction, lower security (email compromise). Rejected.
- Hardware key (WebAuthn): Best security but higher implementation cost and user friction. Deferred to future enhancement.
- Transaction signing with wallet: User signs a challenge with their Stellar wallet. Good for web3-native users but excludes organizers without wallets. Considered for Phase 4 as an alternative factor.

**Acceptance Criteria**:
- [ ] Users can enroll TOTP MFA via Settings page
- [ ] Mainnet financial endpoints reject non-MFA sessions with clear error
- [ ] Testnet operations work without MFA (developer convenience)
- [ ] MFA backup codes generated and shown once during enrollment
- [ ] Session AAL level checked server-side (not trusting client claims)

---

### Issue C8: No Database Transaction Boundaries

**Problem**: Multi-step financial operations can partially commit.

**Recommended Solution**: Supabase RPC functions that encapsulate the critical multi-step operations in PostgreSQL transactions.

**New RPCs Required**:

```sql
-- 1. Atomic escrow funding
CREATE OR REPLACE FUNCTION rpc_confirm_funding(
  p_event_id uuid, p_escrow_id uuid, p_tx_hash text,
  p_amount numeric, p_funding_wallet text, p_actor_id uuid,
  p_network_mode text
) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  -- All within implicit transaction
  UPDATE escrow_accounts SET
    state = CASE WHEN expected_balance + p_amount >= (SELECT prize_pool_target FROM events WHERE id = p_event_id) THEN 'FullyFunded' ELSE 'PartiallyFunded' END,
    expected_balance = expected_balance + p_amount,
    funding_wallet = p_funding_wallet,
    version = version + 1
  WHERE id = p_escrow_id;

  INSERT INTO transactions (event_id, escrow_id, type, tx_hash, amount, from_address, to_address, status, network_mode)
  VALUES (p_event_id, p_escrow_id, 'fund', p_tx_hash, p_amount, p_funding_wallet,
    (SELECT stellar_public_key FROM escrow_accounts WHERE id = p_escrow_id),
    'confirmed', p_network_mode);

  INSERT INTO audit_records (action, actor_id, event_id, resource_type, resource_id, tx_hash, wallet_address, amount, on_chain_status)
  VALUES ('escrow.fund', p_actor_id, p_event_id, 'escrow_accounts', p_escrow_id, p_tx_hash, p_funding_wallet, p_amount, 'confirmed');

  RETURN jsonb_build_object('success', true, 'new_state',
    (SELECT state FROM escrow_accounts WHERE id = p_escrow_id));
END;
$$;

-- 2. Atomic disbursement recording
CREATE OR REPLACE FUNCTION rpc_record_disbursement_batch(
  p_event_id uuid, p_escrow_id uuid,
  p_payments jsonb, -- [{winner_id, recipient_id, destination, amount, tx_hash}]
  p_network_mode text, p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_payment jsonb;
  v_paid_count int := 0;
BEGIN
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
    -- Update winner status
    UPDATE winners SET disbursement_status = 'disbursed'
    WHERE id = (v_payment->>'winner_id')::uuid;

    -- Record transaction
    INSERT INTO transactions (event_id, escrow_id, type, tx_hash, amount, from_address, to_address, status, network_mode)
    VALUES (p_event_id, p_escrow_id, 'disbursement',
      v_payment->>'tx_hash', (v_payment->>'amount')::numeric,
      (SELECT stellar_public_key FROM escrow_accounts WHERE id = p_escrow_id),
      v_payment->>'destination', 'confirmed', p_network_mode);

    v_paid_count := v_paid_count + 1;
  END LOOP;

  -- Audit
  INSERT INTO audit_records (action, actor_id, event_id, resource_type, resource_id, metadata)
  VALUES ('escrow.disburse', p_actor_id, p_event_id, 'escrow_accounts', p_escrow_id,
    jsonb_build_object('paid_count', v_paid_count));

  RETURN jsonb_build_object('paid_count', v_paid_count);
END;
$$;
```

**Acceptance Criteria**:
- [ ] Funding confirmation is atomic (escrow state + transaction + audit in one commit)
- [ ] Disbursement recording is atomic per batch
- [ ] Failure at any step rolls back the entire operation
- [ ] RPCs are called from TypeScript services via `supabase.rpc()`
- [ ] Existing `EscrowRepository` methods refactored to use RPCs


---

### Issue H1: Permission Engine Incomplete (3/10 Roles)

**Recommended Solution**: Complete the RBAC matrix for all 10 roles across all 12 resource categories.

**Full Permission Matrix**:

| Role | Events | Submissions | Evaluations | Teams | Escrow | Disputes | Workspace | Users | Notifications | Audit | Invitations | Comments |
|------|--------|-------------|-------------|-------|--------|----------|-----------|-------|---------------|-------|-------------|----------|
| PlatformAdmin | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | Read | CRUD | CRUD |
| WorkspaceOwner | CRUD* | Read | Read | Read | Read | Read | CRUD | Read | Own | Read | CRUD | CRUD |
| WorkspaceAdmin | CRU* | Read | Read | Read | Read | Read | RU | Read | Own | Read | CRUD | CRUD |
| Organizer | CRU* | Read | Read | Read | CRU | CRUD | Read | Read | Own | Read | CRUD | CRUD |
| Judge | Read | Read† | CRUD‡ | Read | — | Read | — | — | Own | — | — | CRUD |
| Participant | Read | CRUD§ | — | CRUD§ | — | Create | — | — | Own | — | — | CRUD |
| Sponsor | Read | — | — | — | Read | — | — | — | Own | — | — | Read |
| Mentor | Read | Read | — | Read | — | — | — | — | Own | — | — | CRUD |
| TeamCaptain | Read | CRUD§ | — | CRU | — | Create | — | — | Own | — | — | CRUD |
| TeamMember | Read | Read§ | — | Read | — | Create | — | — | Own | — | — | CRUD |

*Legend*: * = within their workspace/event only; † = assigned submissions only; ‡ = own evaluations only; § = own team's submissions only

**ABAC Validators**:
```typescript
const ABAC_VALIDATORS: Record<string, AbacValidator> = {
  'Judge.Evaluations.create': (ctx) =>
    ctx.attributes?.assignedSubmissionIds?.includes(ctx.attributes?.targetSubmissionId ?? '') ?? false,
  'Organizer.Events.update': (ctx) =>
    EDITABLE_EVENT_STATES.has(ctx.attributes?.eventState as EventState),
  'Participant.Disputes.create': (ctx) =>
    ctx.attributes?.eventState === 'DisputeWindow',
  'TeamCaptain.Teams.update': (ctx) =>
    ctx.attributes?.isOwner === true,
};
```

**Acceptance Criteria**:
- [ ] All 10 roles have explicit permission rules in `permission-engine.ts`
- [ ] Legacy `requireEventRole`/`requireWorkspaceRole` deprecated with `@deprecated` JSDoc
- [ ] All route handlers migrated to use `authorize()` (which calls PermissionEngine)
- [ ] Integration tests verify each role's access for each resource category
- [ ] ABAC validators enforce contextual rules (event state, ownership, assignment)

---

### Issue H2: Login Page Dark Mode

**Problem**: Login page uses hardcoded `bg-neutral-50`, `text-neutral-900` etc.

**Recommended Solution**: Replace all hardcoded Tailwind color classes with CSS variables.

**Changes**: Replace color utilities:
- `bg-neutral-50` → `bg-[var(--bg)]`
- `text-neutral-900` → `text-[var(--text)]`
- `text-neutral-500` → `text-[var(--text-muted)]`
- `border-neutral-300` → `border-[var(--border)]`
- `bg-neutral-900` (button) → `bg-[var(--btn-primary-bg)]`
- `text-white` (button) → `text-[var(--btn-primary-text)]`
- `border-red-200` → `border-[var(--error)]`
- `bg-red-50` → `bg-[var(--error-bg)]`

**Acceptance Criteria**:
- [ ] Login page renders correctly in both light and dark mode
- [ ] No hardcoded color classes remain
- [ ] Visual parity with the rest of the authenticated app
- [ ] Also fix `FormEvent` deprecation (use `React.FormEvent<HTMLFormElement>`)

---

### Issue H3: Domain Event Publisher Loses Events

**Problem**: `publishDomainEvent` catches all errors and logs them. Audit records can be silently lost.

**Recommended Solution**: Transactional outbox pattern.

**Implementation**:
1. Create `domain_events` table:
```sql
CREATE TABLE domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX idx_domain_events_status ON domain_events (status) WHERE status = 'pending';
```

2. Modify `publishDomainEvent` to INSERT into `domain_events` table (same transaction as the business operation via RPC)
3. Create a background processor (`/api/cron/process-events`) that:
   - Reads `pending` events ordered by `created_at`
   - Processes each (write audit, send notification)
   - Marks as `processed` on success, increments `attempts` on failure
   - Retries up to 5 times with exponential backoff
   - Alerts on repeated failures

**Alternative**: Immediate processing with retry queue — simpler but still loses events on process crash. The outbox pattern guarantees at-least-once delivery because the event record is committed in the same transaction as the business operation.

**Acceptance Criteria**:
- [ ] Domain events persisted atomically with their triggering operation
- [ ] Background processor handles all event types
- [ ] Failed events retried up to 5 times
- [ ] Alert mechanism for permanently failed events
- [ ] Audit records never silently lost


---

### Issue H4: No Duplicate Winner Constraint

**Recommended Solution**: Add unique constraint.
```sql
ALTER TABLE winners ADD CONSTRAINT winners_event_recipient_unique
  UNIQUE (event_id, recipient_id);
```

**Acceptance Criteria**:
- [ ] Constraint exists and migration applied
- [ ] API returns 409 Conflict if duplicate winner assignment attempted
- [ ] Existing data validated for duplicates before migration (none should exist)

---

### Issue H5: Team Prize Splitting

**Recommended Solution**: Add `prize_split_policy` to events and implement team-aware disbursement.

**Schema Change**:
```sql
ALTER TABLE events ADD COLUMN prize_split_policy text
  NOT NULL DEFAULT 'captain_receives'
  CHECK (prize_split_policy IN ('captain_receives', 'equal_split', 'custom'));
```

**Service Change**: In `DisbursementService.executeDisbursement()`, when a winner has a `team_id`:
- `captain_receives`: Pay to `teams.captain_id`'s verified wallet
- `equal_split`: Divide `prize_amount` by team member count, pay each member
- `custom`: Use a `prize_allocations` JSONB on the winner record

**Acceptance Criteria**:
- [ ] Prize split policy selectable during event creation (Step 3 of wizard)
- [ ] Disbursement correctly applies the chosen policy
- [ ] Team members without wallets get "held" status individually
- [ ] Organizer can see per-member allocation in winners page

---

### Issue H6: Missing Terms/Privacy Pages

**Recommended Solution**: Create static pages at `web/app/(public)/terms/page.tsx` and `web/app/(public)/privacy/page.tsx`.

**Acceptance Criteria**:
- [ ] Both pages accessible without authentication
- [ ] Content covers: data collection, Stellar wallet data handling, escrow terms, dispute process
- [ ] Signup flow requires terms acceptance before account creation
- [ ] Footer links resolve correctly

---

### Issue H7: Wallet Removal Without Escrow Check

**Recommended Solution**: Add server-side validation before wallet deletion.

**Implementation**: Create API route `DELETE /api/wallets/[id]` that:
1. Checks if wallet's `public_key` is referenced in any `winners` record with `disbursement_status = 'pending'`
2. Checks if wallet is the `funding_wallet` on any active escrow
3. If either check fails, return 409 with explanation
4. Replace the client-side Supabase delete with this API call

**Acceptance Criteria**:
- [ ] Cannot remove wallet while it's a pending winner destination
- [ ] Cannot remove wallet while it's an active escrow funding source
- [ ] Clear error message explains why removal is blocked
- [ ] User directed to complete pending operations first

---

### Issue H8: No Disbursement Retry

**Recommended Solution**: Mirror the `RefundService` retry pattern in `DisbursementService`.

**Implementation**:
- Add `MAX_DISBURSEMENT_RETRIES = 3` constant
- Wrap each batch submission in a retry loop with exponential backoff
- On final failure, mark affected winners as `held` with reason `"Transaction failed after retries"`
- Notify organizer of partial disbursement failure

**Acceptance Criteria**:
- [ ] Each batch retried up to 3 times before marking winners as held
- [ ] Exponential backoff between retries (1s, 2s, 4s)
- [ ] Partial success: successful batches recorded, failed batches held
- [ ] Organizer notified with count of held winners

---

### Issue H9: Registration Deadline Auto-Enforcement

**Recommended Solution**: Cron job that checks events in `RegistrationOpen` state whose deadline has passed.

**Implementation**: Add to `/api/cron/transitions` route:
```typescript
// Find events where registration_deadline < now() and state = 'RegistrationOpen'
const { data: expired } = await supabase
  .from('events')
  .select('id, version')
  .eq('state', 'RegistrationOpen')
  .lt('registration_deadline', new Date().toISOString());

for (const event of expired ?? []) {
  await supabase.from('events')
    .update({ state: 'RegistrationClosed', version: event.version + 1 })
    .eq('id', event.id)
    .eq('version', event.version); // Optimistic lock
}
```

**Scheduling**: Vercel Cron or Supabase pg_cron running every 5 minutes.

**Acceptance Criteria**:
- [ ] Events auto-transition from RegistrationOpen to RegistrationClosed when deadline passes
- [ ] Cron runs every 5 minutes
- [ ] Optimistic lock prevents race with manual transitions
- [ ] Audit record written for auto-transitions

---

### Issue H10: Stellar Account Minimum Reserve

**Recommended Solution**: Before disbursement, verify the escrow account will retain enough for the Stellar minimum reserve (currently 1 XLM base + 0.5 XLM per subentry).

**Implementation**: In `validatePrizeAllocation()`:
```typescript
const STELLAR_BASE_RESERVE = 1; // XLM
const STELLAR_ENTRY_RESERVE = 0.5; // per subentry (trustline, offer, etc.)
const STELLAR_TX_FEE = 0.00001 * batchCount; // base fee per operation

const minRetainedBalance = STELLAR_BASE_RESERVE + STELLAR_TX_FEE;
const maxDisbursable = onChainBalance - minRetainedBalance;

if (totalAllocated > maxDisbursable) {
  throw new ValidationError("Prize allocation exceeds disbursable balance after reserves.", {
    onChainBalance, minRetained: minRetainedBalance, maxDisbursable, attemptedTotal: totalAllocated
  });
}
```

**Acceptance Criteria**:
- [ ] Validation accounts for Stellar base reserve
- [ ] Validation accounts for transaction fees (per operation)
- [ ] Clear error message shows available vs requested amounts


---

## Part 3: UI/UX Improvement Plan

### Page-by-Page Recommendations

#### Landing Page (`web/app/page.tsx`)
- ✅ No changes needed (passes pre-flight check)
- Enhancement: Add animated escrow flow diagram in "How it works" section
- Enhancement: Add trust signals (event count, total XLM disbursed, participant count)
- Enhancement: Add testimonial section (placeholder until real testimonials available)

#### Login Page (`web/app/(auth)/login/page.tsx`)
- **Fix**: Replace all hardcoded color classes with CSS variables
- **Fix**: Replace deprecated `FormEvent` with `React.FormEvent<HTMLFormElement>`
- **Add**: Link to signup page in footer text
- **Add**: OAuth buttons (Google, GitHub) — deferred to Phase 6

#### Signup Page (NEW — `web/app/(auth)/signup/page.tsx`)
- Fields: display_name, email, password, confirm_password, terms_checkbox
- Layout: Matches login page structure (centered card)
- Validation: Client-side + Supabase server-side
- After submit: Show "Check your email" confirmation screen
- Back link: "Already have an account? Sign in"

#### Dashboard (`web/app/(app)/dashboard/page.tsx`)
- ✅ Well-structured — no critical changes
- Enhancement: Add "Getting Started" checklist for new users (create workspace → connect wallet → create event)
- Enhancement: Add notification feed inline (last 5 notifications)
- Enhancement: Add "Events needing attention" urgency indicator for organizers

#### Create Event Wizard (`web/app/(app)/events/new/page.tsx`)
- **Add**: "Discard draft" button in step rail
- **Add**: Prize split policy selector in Step 3
- **Add**: Eligibility rules (simple text field for now) in Step 2
- **Fix**: Pre-select first workspace only on initial load (not on every render)
- Enhancement: Show estimated USD equivalent next to XLM prize amount (price oracle)
- Enhancement: Add "Import from template" option at top

#### Event Detail (`web/app/(app)/events/[id]/page.tsx`)
- **Add**: Breadcrumb navigation: Dashboard > Events > [Event Title]
- **Add**: Progress indicators (funding %, evaluation completion %, team count)
- **Add**: "Preview as participant" link for organizers
- Enhancement: Visual timeline of event lifecycle with current position highlighted
- Enhancement: Trust signal banner showing escrow verification status prominently

#### Teams Page (`web/app/(app)/events/[id]/teams/page.tsx`)
- **Add**: Empty state with "Create a team" CTA for participants
- **Add**: Team size indicator (e.g., "3/5 members")
- **Add**: Captain badge next to captain's name
- Enhancement: Join request notification for captains

#### Submissions Page (`web/app/(app)/events/[id]/submissions/page.tsx`)
- **Add**: File upload dropzone with drag-and-drop
- **Add**: Version history accordion
- **Add**: "Edit submission" flow for pre-deadline resubmission
- Enhancement: Show submission completeness indicator

#### Winners Page (`web/app/(app)/events/[id]/winners/page.tsx`)
- **Add**: Disbursement status badges (paid ✓, held ⏳, pending ○)
- **Add**: "Trigger Disbursement" button with confirmation dialog for organizer
- **Add**: Transaction hash links to Stellar Expert
- Enhancement: Prize split breakdown for team prizes

#### Disputes Page (`web/app/(app)/events/[id]/disputes/page.tsx`)
- **Add**: "File Dispute" form (only visible during DisputeWindow state)
- **Add**: Evidence upload
- **Add**: Resolution form for organizers
- Enhancement: Dispute timeline with state transitions

#### Settings Page (`web/app/(app)/settings/page.tsx`)
- **Add**: MFA enrollment section (QR code + backup codes)
- **Add**: Active sessions list with "Revoke" button
- **Add**: Account deletion flow
- **Fix**: Remove unused `userId` parameter
- **Fix**: Replace deprecated `FormEvent`

#### Admin Dashboard (NEW — `web/app/(app)/admin/page.tsx`)
- Platform-wide metrics (users, events, escrow value, disputes)
- User management table (search, suspend, delete)
- Event moderation queue (flagged events, reported content)
- Escrow reconciliation status overview
- Audit log viewer with filters

#### Workspace Creation (NEW — `web/app/(app)/workspaces/new/page.tsx`)
- Fields: name, slug (auto-generated from name), description
- Validation: Slug uniqueness check
- After create: Redirect to workspace dashboard
- Simple single-step form (not a wizard — workspaces are lightweight)

---

## Part 4: Backend Improvement Plan

### 4.1 Service Layer Refactoring

| Service | Action | Priority |
|---------|--------|----------|
| `disbursement.service.ts` | Add mutex via advisory lock RPC | Critical |
| `disbursement.service.ts` | Add retry logic (mirror RefundService) | High |
| `disbursement.service.ts` | Replace inline DB writes with `rpc_record_disbursement_batch` | High |
| `funding.service.ts` | Replace inline writes with `rpc_confirm_funding` | High |
| `publisher.ts` | Replace fire-and-forget with transactional outbox | High |
| All services | Standardize on `authorize()` for permission checks | High |
| `dispute.ts` | Add dispute deadline (auto-dismiss after N days) | Medium |
| `team.ts` | Add captain-transfer and team-disband logic | Medium |

### 4.2 API Layer Improvements

| Route | Action | Priority |
|-------|--------|----------|
| All `/api/events/*` routes | Migrate to consistent `apiHandler` pattern | Medium |
| `DELETE /api/wallets/[id]` | New route with escrow check | High |
| `/api/cron/transitions` | New route for deadline enforcement | High |
| `/api/cron/process-events` | New route for outbox processing | High |
| `/api/admin/*` | New admin routes (user mgmt, moderation) | Medium |
| All routes | Add request body size limit (1MB) | High |

### 4.3 Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `reconcile` | Every 30 min | Verify on-chain escrow balances match DB |
| `transitions` | Every 5 min | Auto-close expired registrations |
| `process-events` | Every 1 min | Process domain event outbox |
| `cleanup-idempotency` | Every 24h | Remove expired idempotency keys |
| `dispute-deadline` | Every 1h | Auto-dismiss disputes past deadline |

### 4.4 Logging & Monitoring

- Add structured logging with request ID correlation
- Add Sentry or equivalent error tracking
- Add financial operation alerting (any disbursement > threshold, any failed transaction)
- Add health check for Stellar Horizon connectivity
- Add reconciliation divergence alerting


---

## Part 5: Database Improvement Plan

### 5.1 New Migrations Required

```
20250101000014_disbursement_lock.sql     -- Advisory lock RPCs
20250101000015_financial_precision.sql   -- numeric(20,7) on all amount columns
20250101000016_domain_events_outbox.sql  -- Transactional outbox table
20250101000017_winner_uniqueness.sql     -- Unique constraint on winners
20250101000018_prize_split_policy.sql    -- Prize split column on events
20250101000019_dispute_deadline.sql      -- Auto-dismiss timestamp on disputes
20250101000020_wallet_protection.sql     -- Function to check wallet dependencies
```

### 5.2 Precision Migration (`20250101000015`)

```sql
-- Standardize all financial columns to 7 decimal places (Stellar stroops)
ALTER TABLE escrow_accounts
  ALTER COLUMN expected_balance TYPE numeric(20,7),
  ALTER COLUMN last_reconciled_balance TYPE numeric(20,7);

ALTER TABLE transactions
  ALTER COLUMN amount TYPE numeric(20,7);

ALTER TABLE winners
  ALTER COLUMN prize_amount TYPE numeric(20,7);

ALTER TABLE events
  ALTER COLUMN prize_pool_target TYPE numeric(20,7);
```

### 5.3 Index Recommendations

```sql
-- Improve disbursement query performance
CREATE INDEX idx_winners_event_pending ON winners (event_id)
  WHERE disbursement_status = 'pending';

-- Improve dispute blocking check
CREATE INDEX idx_disputes_event_unresolved ON disputes (event_id)
  WHERE state IN ('Open', 'UnderReview');

-- Outbox processing
CREATE INDEX idx_domain_events_pending ON domain_events (created_at)
  WHERE status = 'pending';
```

---

## Part 6: Smart Contract Improvement Plan

### Phase 1 (Current Sprint): Documentation & Formalization

1. Write ADR: "Horizon as Execution Layer, Soroban as State Tracking"
2. Document the state mapping table in code comments
3. Add `get_event_id()` query method for cross-reference
4. Add TTL refresh in `deposit()` and `lock()` methods

### Phase 4 (Future Sprint): Full Soroban Execution

1. Add `admin_deposit(from, amount)` for sponsor deposits
2. Split `disburse()` into `disburse_batch()` + `finalize()`
3. Add `DisbursedTotal` tracking for partial disbursement
4. Deploy per-event contract instances (factory pattern)
5. Add `cancel()` method (distinct from `refund()` — sets Cancelled state)
6. Add reentrancy guard (though Soroban's model largely prevents it)
7. Full Stellar security audit before mainnet deployment

### Contract Testing Strategy

- Unit tests via `soroban-sdk` test framework
- Integration tests against Stellar Testnet
- Fuzz testing on deposit/disburse amounts
- Gas usage profiling
- TTL behavior verification under long escrow durations

---

## Part 7: Security Hardening Plan

### 7.1 Immediate (Phase 1)

| Action | File | Effort |
|--------|------|--------|
| Add rate limiting (Upstash Redis) | middleware.ts, lib/rate-limit.ts | 4h |
| Add request body size limit | middleware.ts | 1h |
| Add CAPTCHA on auth forms (Cloudflare Turnstile) | login, signup pages | 4h |
| Secure cron endpoints (secret header) | api/cron/* routes | 2h |
| Add Content-Length header check | middleware.ts | 1h |

### 7.2 Phase 2

| Action | File | Effort |
|--------|------|--------|
| Complete PermissionEngine (10 roles) | permission-engine.ts | 8h |
| Migrate all routes to authorize() | All route handlers | 12h |
| Remove/deprecate legacy auth helpers | lib/auth/permissions.ts | 2h |
| Add disbursement mutex | disbursement.service.ts + migration | 4h |
| Add wallet removal protection | API route + migration | 3h |

### 7.3 Phase 3

| Action | File | Effort |
|--------|------|--------|
| MFA enrollment UI | settings/page.tsx | 8h |
| MFA enforcement middleware | middleware.ts | 4h |
| Session management (view/revoke) | settings + API | 6h |
| Account deletion flow | settings + API | 4h |
| Audit all RLS policies for completeness | Supabase dashboard | 4h |

### 7.4 Security Testing Requirements

- OWASP Top 10 verification checklist
- Penetration test on auth flow (credential stuffing, session fixation)
- SQL injection testing (Supabase parameterizes, but verify custom RPCs)
- XSS testing (CSP should block, verify React escaping)
- CSRF testing (SameSite cookies + CSP form-action)
- Stellar transaction replay testing (ensure tx_hash uniqueness prevents replay)
- Advisory lock exhaustion testing (can attacker hold lock indefinitely?)

---

## Part 8: Testing & Validation Strategy

### 8.1 Test Coverage Targets

| Layer | Current | Target | Priority |
|-------|---------|--------|----------|
| Financial services | ~10% | 90% | Critical |
| State machines | ~30% | 95% | Critical |
| Permission engine | ~0% | 90% | High |
| API routes | ~15% | 80% | High |
| UI components | ~5% | 60% | Medium |
| E2E flows | ~0% | Key flows | High |

### 8.2 Critical Test Cases Required

**Financial Flow Tests**:
1. Happy path: fund → disburse → verify on-chain
2. Concurrent disbursement (must reject second)
3. Partial batch failure (batch 1 succeeds, batch 2 fails)
4. KMS unavailable during disbursement
5. Stellar Horizon timeout during submission
6. Refund after partial disbursement
7. Disbursement with held winners (no wallet)
8. Prize allocation exceeding balance
9. Stellar reserve calculation accuracy
10. Duplicate funding verification (same tx_hash)

**Permission Tests**:
11. Each role × each resource × each action (matrix coverage)
12. ABAC: Judge can only evaluate assigned submissions
13. ABAC: Organizer can only edit in editable states
14. Cross-event isolation (user in Event A cannot access Event B data)
15. Workspace isolation (Workspace A organizer cannot modify Workspace B events)

**State Machine Tests**:
16. Every valid transition with preconditions met
17. Every invalid transition (returns correct error + valid alternatives)
18. Concurrent state transitions (optimistic lock rejection)
19. Full lifecycle traversal (Draft → Completed)
20. Cancellation from every state (with escrow implications)

### 8.3 Test Infrastructure

- **Unit tests**: Vitest (already configured)
- **Integration tests**: Vitest with Supabase test instance
- **E2E tests**: Playwright for critical user journeys
- **Contract tests**: Soroban SDK test framework
- **Load tests**: k6 for concurrent disbursement testing


---

## Part 9: Implementation Roadmap

### Phase 1: Critical Blockers (Week 1-2)

**Objective**: Eliminate financial vulnerabilities and unblock user onboarding.

**Tasks**:
| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 1.1 | Create disbursement advisory lock RPC + migration | 4h | — |
| 1.2 | Integrate lock into DisbursementService | 4h | 1.1 |
| 1.3 | Add rate limiting (Upstash Redis) | 6h | — |
| 1.4 | Create signup page | 6h | — |
| 1.5 | Create auth layout (shared by login/signup) | 2h | — |
| 1.6 | Fix login page dark mode (CSS variables) | 2h | — |
| 1.7 | Create workspace creation page | 4h | — |
| 1.8 | Create terms + privacy pages | 3h | — |
| 1.9 | Secure cron endpoints (secret header) | 2h | — |
| 1.10 | Add request body size limit in middleware | 1h | — |
| 1.11 | Financial precision migration (numeric 20,7) | 2h | — |
| 1.12 | Winner uniqueness constraint migration | 1h | — |
| 1.13 | Write ADR for Soroban/Horizon architecture | 2h | — |
| 1.14 | Add disbursement retry logic | 4h | 1.2 |
| 1.15 | Add Stellar reserve validation | 2h | — |

**Dependencies**: Upstash Redis account setup (1.3)

**Risks**:
- Rate limiting false positives during testing (mitigation: high limits in development)
- Migration rollback: all migrations have corresponding `_down` scripts

**Expected Outcomes**:
- No double-disbursement possible
- New users can register
- Auth endpoints protected against brute force
- Financial amounts stored with correct precision

**Success Criteria**:
- [ ] Concurrent disbursement test passes (100 parallel requests, only 1 succeeds)
- [ ] Signup → email confirm → login → dashboard flow works end-to-end
- [ ] Rate limit returns 429 after threshold exceeded
- [ ] All financial columns use numeric(20,7)

---

### Phase 2: Core Workflow Completion (Week 3-4)

**Objective**: Complete all user journeys and permission system.

**Tasks**:
| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 2.1 | Complete PermissionEngine (all 10 roles) | 8h | — |
| 2.2 | Migrate all routes to authorize() | 12h | 2.1 |
| 2.3 | Database transaction RPCs (funding, disbursement) | 8h | — |
| 2.4 | Refactor services to use RPCs | 6h | 2.3 |
| 2.5 | Registration deadline cron job | 4h | — |
| 2.6 | Wallet removal protection API | 3h | — |
| 2.7 | Prize split policy (schema + service + UI) | 8h | — |
| 2.8 | Domain event outbox table + processor | 8h | — |
| 2.9 | Dispute deadline auto-dismiss | 3h | — |
| 2.10 | Team captain transfer API | 4h | — |
| 2.11 | Admin dashboard (basic: users + events) | 12h | 2.1 |
| 2.12 | Notification center page | 4h | — |

**Expected Outcomes**:
- Every role can perform all expected actions
- Financial operations are atomic (no partial commits)
- Automated lifecycle transitions work
- Admin can manage platform

**Success Criteria**:
- [ ] Permission matrix test: 10 roles × 6 actions × 12 resources all verified
- [ ] Funding confirmation atomic (escrow + transaction + audit in one commit or none)
- [ ] Registration auto-closes on deadline
- [ ] Admin can view users, suspend accounts, view audit log

---

### Phase 3: Security Hardening (Week 5-6)

**Objective**: Production-grade security posture.

**Tasks**:
| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 3.1 | MFA enrollment UI in settings | 8h | — |
| 3.2 | MFA enforcement middleware for mainnet ops | 4h | 3.1 |
| 3.3 | CAPTCHA on auth forms (Turnstile) | 4h | — |
| 3.4 | Session management UI (view/revoke) | 6h | — |
| 3.5 | Account deletion flow | 4h | — |
| 3.6 | Audit RLS policies (comprehensive review) | 4h | — |
| 3.7 | Remove legacy auth helpers (deprecated) | 2h | Phase 2 |
| 3.8 | OWASP Top 10 verification | 8h | — |
| 3.9 | Penetration test (auth flow) | 8h | 3.3 |
| 3.10 | Input validation audit (all Zod schemas) | 4h | — |

**Expected Outcomes**:
- MFA required for mainnet financial ops
- No brute-force possible on any form
- Users can manage their sessions
- GDPR-compliant account deletion
- All OWASP Top 10 items verified

**Success Criteria**:
- [ ] Mainnet disburse endpoint rejects non-MFA session
- [ ] CAPTCHA blocks automated signup attempts
- [ ] Session revocation immediately invalidates token
- [ ] Account deletion removes all PII within 30 days
- [ ] Zero critical findings in pen test report

---

### Phase 4: Blockchain Optimization (Week 7)

**Objective**: Resolve Soroban contract issues and prepare for mainnet.

**Tasks**:
| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 4.1 | Contract: Add `admin_deposit` method | 4h | — |
| 4.2 | Contract: Split disburse into batch + finalize | 6h | — |
| 4.3 | Contract: Add TTL refresh in all write methods | 2h | — |
| 4.4 | Contract: Add DisbursedTotal tracking | 2h | 4.2 |
| 4.5 | Contract: Unit tests (all methods + edge cases) | 8h | 4.1-4.4 |
| 4.6 | Backend: State sync service (contract ↔ DB) | 6h | 4.1-4.4 |
| 4.7 | Backend: Reconciliation compares contract state | 4h | 4.6 |
| 4.8 | Testnet deployment + integration testing | 4h | 4.5 |
| 4.9 | Gas usage profiling + optimization | 4h | 4.8 |
| 4.10 | Write mainnet deployment checklist | 2h | All above |

**Expected Outcomes**:
- Contract supports multi-batch disbursement
- Sponsors can deposit via contract
- State synchronized between backend and on-chain
- Gas costs acceptable for production usage

**Success Criteria**:
- [ ] 200-winner disbursement completes successfully (2 batches)
- [ ] Sponsor deposit via contract works end-to-end
- [ ] Reconciliation detects and reports state divergence
- [ ] Gas cost per disbursement batch < 100,000 stroops

---

### Phase 5: Performance & Scalability (Week 8)

**Objective**: Optimize for production load.

**Tasks**:
| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 5.1 | Queue-based disbursement (Bull/Redis) | 8h | Phase 1 |
| 5.2 | Response caching for public endpoints | 4h | — |
| 5.3 | Database query optimization (N+1 audit) | 4h | — |
| 5.4 | Connection pooling (Supabase Pooler) | 2h | — |
| 5.5 | Image/asset optimization (next/image) | 2h | — |
| 5.6 | Bundle analysis + code splitting | 4h | — |
| 5.7 | Load testing (k6) — target: 100 concurrent users | 8h | — |
| 5.8 | Add monitoring (Sentry + custom metrics) | 6h | — |
| 5.9 | Vercel/deployment configuration | 4h | — |
| 5.10 | Environment variables audit (production secrets) | 2h | — |

**Success Criteria**:
- [ ] p95 response time < 500ms for dashboard page
- [ ] Discover page handles 100 concurrent users without degradation
- [ ] Disbursement queue processes asynchronously (no timeout)
- [ ] Sentry captures and alerts on all unhandled errors
- [ ] Bundle size < 200KB first load (gzipped)

---

### Phase 6: UX Refinement (Week 9)

**Objective**: Polish all interfaces to production quality.

**Tasks**:
| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 6.1 | Breadcrumb navigation on all event sub-pages | 4h | — |
| 6.2 | OAuth login (Google, GitHub via Supabase) | 6h | — |
| 6.3 | Event template system (duplicate existing event) | 6h | — |
| 6.4 | Progress indicators (funding %, eval completion) | 4h | — |
| 6.5 | Email notification templates (Resend) | 8h | — |
| 6.6 | Escrow flow diagram on landing page | 4h | — |
| 6.7 | Organizer onboarding checklist | 4h | — |
| 6.8 | Mobile navigation refinement (icons, gestures) | 4h | — |
| 6.9 | Accessibility audit (axe-core automated) | 4h | — |
| 6.10 | Empty state illustrations | 4h | — |

**Success Criteria**:
- [ ] Every page has appropriate loading, empty, and error states
- [ ] Mobile nav usable with one hand (thumb zone)
- [ ] axe-core reports zero critical accessibility issues
- [ ] OAuth login functional (Google + GitHub)
- [ ] Email notifications sent for: event state changes, dispute filed, prize paid

---

### Phase 7: Production Readiness (Week 10)

**Objective**: Final verification, documentation, and launch preparation.

**Tasks**:
| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 7.1 | Full E2E test suite (Playwright) — 10 critical flows | 12h | All phases |
| 7.2 | Financial flow integration tests (testnet) | 8h | Phase 4 |
| 7.3 | Security review of all Phase 1-6 changes | 4h | All phases |
| 7.4 | Production environment setup (env vars, secrets) | 4h | — |
| 7.5 | Backup and disaster recovery plan | 4h | — |
| 7.6 | Runbook for common operational tasks | 4h | — |
| 7.7 | API documentation (OpenAPI spec) | 8h | — |
| 7.8 | User documentation (help center content) | 6h | — |
| 7.9 | Load test at production scale | 4h | 5.7 |
| 7.10 | Final go/no-go assessment | 2h | All |

**Success Criteria**:
- [ ] All E2E tests pass on production-like environment
- [ ] Financial flow tested on Stellar Testnet with real transactions
- [ ] Disaster recovery tested (database restore, secret rotation)
- [ ] API documentation covers all public endpoints
- [ ] Score on re-audit: 85+/100


---

## Part 10: Updated User Journey Validation (Post-Remediation)

### Visitor → Registered User

| Step | Before | After | Notes |
|------|--------|-------|-------|
| Land on homepage | ✅ | ✅ + trust signals | Add escrow diagram, stats |
| Click "Get started" | ❌ No signup page | ✅ Signup page | Phase 1.4 |
| Fill signup form | ❌ | ✅ Name + email + password + terms | Phase 1.4 |
| Receive confirmation email | ❌ | ✅ Supabase email confirm | Phase 1.4 |
| Confirm email | ❌ | ✅ Redirect to dashboard | Auth callback handles |
| Login | ✅ Broken dark mode | ✅ Fixed | Phase 1.6 |
| See dashboard | ✅ | ✅ + onboarding checklist | Phase 6.7 |
| Connect wallet | ✅ | ✅ | No change needed |
| Browse events | ✅ | ✅ | No change needed |

**Validated**: Complete flow, no dead ends.

### Organizer Journey (Complete Lifecycle)

| Step | Before | After |
|------|--------|-------|
| Create workspace | ⚠️ No page | ✅ Phase 1.7 |
| Create event (wizard) | ✅ | ✅ + prize split + discard draft |
| Fund escrow | ✅ | ✅ + reserve check + precision |
| Publish event | ✅ | ✅ |
| Registration auto-closes | ❌ | ✅ Phase 2.5 |
| Assign judges | ✅ | ✅ |
| Accept participants | ✅ | ✅ |
| Lock teams | ✅ | ✅ |
| Open submissions | ✅ | ✅ |
| Close submissions | ✅ | ✅ |
| Monitor judging | ✅ | ✅ + progress indicator |
| Finalize judging | ✅ | ✅ |
| Dispute window | ✅ | ✅ + auto-deadline |
| Approve winners | ✅ | ✅ |
| Trigger disbursement | ✅ | ✅ + mutex + retry + MFA (mainnet) |
| View transaction proof | ✅ | ✅ |
| Event complete | ✅ | ✅ |

**Validated**: Full lifecycle complete with all protections.

### Participant Journey

| Step | Before | After |
|------|--------|-------|
| Discover event | ✅ | ✅ |
| Register for event | ✅ | ✅ |
| Create/join team | ✅ | ✅ + size indicator |
| Submit project | ✅ | ✅ + drag-drop |
| Edit before deadline | ✅ | ✅ + version history |
| File dispute | ✅ | ✅ + evidence upload |
| Receive prize | ✅ | ✅ + team split policy |
| View certificate | ❌ | Deferred (Phase 6+) |

**Validated**: Complete except certificate (non-blocking).

### Judge Journey

| Step | Before | After |
|------|--------|-------|
| Accept invitation | ✅ | ✅ |
| View assigned submissions | ⚠️ No filtering | ✅ ABAC enforced |
| Score submission | ✅ | ✅ |
| Declare conflict of interest | ✅ | ✅ |
| Submit final scores | ✅ | ✅ |

**Validated**: Complete with proper ABAC enforcement.

### Platform Admin Journey

| Step | Before | After |
|------|--------|-------|
| Access admin dashboard | ❌ No page | ✅ Phase 2.11 |
| View all users | ❌ | ✅ |
| Suspend user | ❌ | ✅ |
| View all events | ⚠️ | ✅ |
| Moderate content | ❌ | ✅ |
| View audit log | ❌ (API only) | ✅ UI viewer |
| Monitor escrow health | ⚠️ Cron only | ✅ Dashboard widget |

**Validated**: Complete after Phase 2.11.

---

## Part 11: Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Upstash Redis downtime blocks auth | Low | High | Fallback to in-memory cache with alert |
| R2 | Migration breaks existing escrow data | Medium | Critical | Run migration on staging first, verify precision |
| R3 | Advisory lock held indefinitely (crash) | Low | Medium | PostgreSQL auto-releases on session end |
| R4 | MFA enrollment confuses non-technical users | Medium | Low | Clear onboarding guide, only required for mainnet |
| R5 | Soroban contract upgrade breaks existing escrows | Low | Critical | Deploy new contract per event, don't upgrade existing |
| R6 | Rate limiting blocks legitimate heavy usage | Medium | Medium | Per-user limits (not per-IP), configurable thresholds |
| R7 | Domain event outbox grows unbounded | Low | Low | Processed events deleted after 7 days |
| R8 | Concurrent migration by two developers | Low | Medium | Migration numbering convention prevents conflicts |
| R9 | KMS key rotation breaks existing encrypted secrets | Low | Critical | Re-encryption script (`migrate-escrow-keys.ts`) already exists |
| R10 | Stellar network congestion delays disbursement | Medium | Medium | Retry logic + user notification + patience |

---

## Part 12: Documentation Updates Required

| Document | Action | Priority |
|----------|--------|----------|
| ADR: Soroban/Horizon architecture | CREATE | Critical |
| ADR: Rate limiting strategy | CREATE | High |
| ADR: Transactional outbox pattern | CREATE | High |
| SECURITY.md | CREATE — responsible disclosure policy | High |
| API.md or OpenAPI spec | CREATE | Medium |
| DEPLOYMENT.md | CREATE — production setup guide | Medium |
| RUNBOOK.md | CREATE — operational procedures | Medium |
| Contributing guide | UPDATE — mention new auth pattern | Low |
| README.md | UPDATE — architecture diagram | Low |
| .env.example | UPDATE — add Upstash, CAPTCHA vars | High |

---

## Part 13: Production Readiness Checklist

### Security
- [ ] Rate limiting active on all endpoints
- [ ] MFA enforced for mainnet financial operations
- [ ] CAPTCHA on authentication forms
- [ ] All endpoints use `authorize()` (PermissionEngine)
- [ ] No leaked secrets in codebase
- [ ] CSP headers strict in production
- [ ] HSTS preload submitted
- [ ] All dependencies pinned and audited
- [ ] Cron endpoints authenticated

### Financial Integrity
- [ ] Disbursement mutex prevents double-spend
- [ ] Database transactions wrap all financial operations
- [ ] Stellar reserve calculated before disbursement
- [ ] Amount precision: numeric(20,7) throughout
- [ ] Reconciliation cron running and alerting on divergence
- [ ] Refund retry logic handles transient failures
- [ ] Prize split policy enforced for team events
- [ ] Audit trail immutable and complete

### Blockchain
- [ ] Contract/backend state mapping documented and synced
- [ ] Reconciliation queries both Horizon balance and contract state
- [ ] Mainnet explicitly gated behind environment flag
- [ ] Transaction fees accounted in balance calculations
- [ ] All on-chain transactions linkable via tx_hash

### User Experience
- [ ] All user roles can complete their full journey
- [ ] No dead-end pages or broken links
- [ ] Loading, empty, and error states on every page
- [ ] Mobile-responsive across all pages
- [ ] Accessibility: zero critical axe-core violations
- [ ] Dark mode works on every page

### Infrastructure
- [ ] Environment variables documented and rotatable
- [ ] Health checks active (/api/health, /api/health/ready)
- [ ] Error tracking (Sentry or equivalent) configured
- [ ] Database backups scheduled
- [ ] Deployment pipeline automated
- [ ] Monitoring dashboards for: response times, error rates, financial operations

### Testing
- [ ] Unit test coverage > 60% overall, > 90% for financial services
- [ ] Integration tests for all critical API endpoints
- [ ] E2E tests for 10 critical user flows
- [ ] Load test passes at 100 concurrent users
- [ ] Financial flow tested on Stellar Testnet

---

## Part 14: Final Go/No-Go Assessment Criteria

The platform is ready for production when ALL of the following are true:

1. **Zero Critical Issues**: No items from the C1-C8 list remain open
2. **Financial Safety**: Double-spend test passes under load, reserve checks prevent overdraft
3. **Security Baseline**: Rate limiting + MFA + CAPTCHA all active
4. **User Journey Complete**: Every role can complete their primary flow without encountering a missing page
5. **Test Coverage**: > 60% overall, > 90% for `lib/services/escrow/*`
6. **Monitoring Active**: Alerts configured for failed transactions, reconciliation divergence, error spikes
7. **Documentation**: API docs, deployment guide, and runbook all complete
8. **Re-Audit Score**: ≥ 85/100 on repeat of FULL_PRODUCTION_AUDIT methodology

**Current Assessment**: NOT READY — proceed with Phase 1 immediately.

---

## Appendix A: Dependency Additions

```json
{
  "@upstash/ratelimit": "^2.0.0",
  "@upstash/redis": "^1.34.0",
  "@cloudflare/turnstile": "^0.2.0",
  "playwright": "^1.45.0" (devDependency),
  "k6": "via npm script" (devDependency)
}
```

## Appendix B: Environment Variables (New)

```
# Rate Limiting (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# CAPTCHA (Cloudflare Turnstile)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Cron Authentication
CRON_SECRET=

# MFA
# (Handled by Supabase Auth — no additional env vars needed)
```

## Appendix C: Total Effort Estimate

| Phase | Duration | Story Points | Team Size |
|-------|----------|--------------|-----------|
| Phase 1: Critical Blockers | 2 weeks | 45 | 2 devs |
| Phase 2: Workflow Completion | 2 weeks | 65 | 2 devs |
| Phase 3: Security Hardening | 2 weeks | 52 | 2 devs |
| Phase 4: Blockchain | 1 week | 42 | 1 dev (Rust) + 1 dev (TS) |
| Phase 5: Performance | 1 week | 44 | 2 devs |
| Phase 6: UX Refinement | 1 week | 48 | 1 dev + 1 designer |
| Phase 7: Production Readiness | 1 week | 52 | 2 devs |
| **Total** | **10 weeks** | **348 points** | **2 devs average** |

---

*End of Remediation Blueprint*
*Target: Score 85+/100 on re-audit after Phase 7 completion*
