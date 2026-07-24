# Stellar Guardian 3.0 — Comprehensive Remediation, Solution Architecture & Production Readiness Plan

**Document Version**: 2.0  
**Created**: July 21, 2026  
**Based on**: FULL_PRODUCTION_AUDIT.md (52/100), ARCHITECTURE_AUDIT.md, DDD_AUDIT.md, SECURITY_AUDIT.md, FINANCIAL_AUDIT.md, TESTING_AUDIT.md, PRODUCT_AUDIT_REPORT.md  
**Target Score**: 85+/100 (Production Ready)  
**Estimated Duration**: 10 weeks (7 phases)  
**Team**: 2–3 full-time engineers

---

## Executive Summary

Stellar Guardian 3.0 scores 52/100 on production readiness — classified as Early Beta. The platform has strong architectural bones (pure state machines, KMS-encrypted escrow keys, signed transactions, immutable audit trail, optimistic concurrency) but critical gaps prevent any live usage with real funds:

1. **Double-spend vulnerability** — concurrent disbursement has no mutual exclusion
2. **Security baseline missing** — no rate limiting, no MFA, no CAPTCHA
3. **Blockchain architecture ambiguity** — Horizon and Soroban both exist as parallel escrow paths without a canonical decision
4. **Incomplete user journeys** — no signup page, no admin panel, no workspace creation page
5. **Financial atomicity absent** — multi-step DB writes without transaction boundaries
6. **Permission system 70% incomplete** — only 3 of 10 roles defined in PermissionEngine
7. **Test coverage ~20%** — critically insufficient for a financial platform

This blueprint provides the complete engineering specification to resolve all 48 identified issues across 7 phases, bringing the platform to a production-ready state (85+/100) within 10 weeks.

**Approach**: Inside-out — database integrity first, then services, then APIs, then UI. Each phase is independently testable with clear acceptance criteria.

---

## Table of Contents

1. [Root Cause Analysis (8 Critical Issues)](#part-1-root-cause-analysis)
2. [Complete Issue Resolution Plan (48 Issues)](#part-2-complete-issue-resolution-plan)
3. [Updated User Journey Validation](#part-3-user-journey-validation)
4. [Role-by-Role Validation](#part-4-role-validation)
5. [Blockchain & Smart Contract Validation](#part-5-blockchain-validation)
6. [UI/UX Improvement Plan](#part-6-uiux-improvement-plan)
7. [Backend Improvement Plan](#part-7-backend-improvement-plan)
8. [API Improvement Plan](#part-8-api-improvement-plan)
9. [Database Improvement Plan](#part-9-database-improvement-plan)
10. [Smart Contract Improvement Plan](#part-10-smart-contract-improvement-plan)
11. [Security Hardening Plan](#part-11-security-hardening-plan)
12. [Scalability & Performance Plan](#part-12-scalability-performance-plan)
13. [Testing & Validation Strategy](#part-13-testing-strategy)
14. [Implementation Roadmap (7 Phases)](#part-14-implementation-roadmap)
15. [Risk Register](#part-15-risk-register)
16. [Production Readiness Checklist](#part-16-production-readiness-checklist)
17. [Documentation Updates Required](#part-17-documentation-updates)
18. [Final Go/No-Go Assessment](#part-18-final-assessment)

---


## Part 1: Root Cause Analysis

### RCA-1: Double-Disbursement Race Condition

| Dimension | Analysis |
|-----------|----------|
| **Problem** | Two concurrent calls to `DisbursementService.executeDisbursement()` both read `pending` winners and submit separate on-chain transactions, paying winners twice. |
| **Root Cause** | Read-then-write pattern without locking. The service was designed as a stateless function call without considering concurrent API requests. |
| **Architectural Origin** | Stateless service design (good for scaling) inadvertently removed coordination needed for financial atomicity. The `idempotency_keys` table exists but was built for HTTP-level deduplication, not wired into disbursement. |
| **Documents to Update** | `disbursement.service.ts`, migration files, API route handler |
| **Modules Affected** | `disbursement.service.ts`, `winners` table, `transactions` table, escrow state machine |
| **Roles Impacted** | Organizer (triggers), Winner (receives double), Platform Admin (reconciles) |
| **Business Impact** | 🔴 Financial loss — escrow drained beyond allocation |
| **Security Impact** | 🔴 Exploitable — malicious organizer could trigger concurrent requests deliberately |
| **Scalability Impact** | Medium — advisory locks are per-database, but sufficient at current scale |
| **Blockchain Impact** | 🔴 On-chain transactions are irreversible — cannot recover double-paid funds |


### RCA-2: No Rate Limiting

| Dimension | Analysis |
|-----------|----------|
| **Problem** | Every endpoint is unprotected against brute-force, credential stuffing, and API abuse. |
| **Root Cause** | Rate limiting was explicitly removed during development (middleware comment: "Re-add with proper Redis backing before production"). Team deferred to avoid Redis infrastructure during dev. |
| **Architectural Origin** | Middleware was designed with a rate-limiting slot but no implementation. Supabase serverless = no persistent in-process state for token buckets. |
| **Documents to Update** | `middleware.ts`, `.env.example`, deployment docs |
| **Modules Affected** | All API routes, auth endpoints, financial endpoints |
| **Roles Impacted** | All — especially anonymous users attacking auth |
| **Business Impact** | 🟠 Service degradation, potential account takeover |
| **Security Impact** | 🔴 Brute-force login, credential stuffing, DDoS amplification |
| **Scalability Impact** | High — unprotected endpoints can be overwhelmed |
| **Blockchain Impact** | Low — Stellar operations already limited by account sequence |


### RCA-3: Soroban Contract State Mismatch

| Dimension | Analysis |
|-----------|----------|
| **Problem** | Soroban contract has 6 states; backend has 9. Deposit auth: contract = organizer-only; backend = any wallet (sponsor use case). |
| **Root Cause** | Contract and backend developed in parallel without shared specification. Contract = minimal viable escrow; backend evolved to handle sponsors, reconciliation states, failures. |
| **Architectural Origin** | Dual-architecture: backend uses Horizon API for actual fund transfers, Soroban exists as separate state-tracking. They don't communicate at runtime, creating "dual-truth." |
| **Documents to Update** | `soroban-escrow.ts`, `contracts/escrow/src/lib.rs`, `state-machine/escrow.ts`, ADR to create |
| **Modules Affected** | All escrow services, blockchain adapters, reconciliation |
| **Roles Impacted** | Organizer (funds), Sponsor (cannot deposit via contract), Platform Admin (reconciles) |
| **Business Impact** | 🟠 Funds could be on-chain in one state while DB shows another |
| **Security Impact** | 🟡 State divergence could mask fraudulent activity |
| **Scalability Impact** | Low — state machines are pure functions |
| **Blockchain Impact** | 🔴 Contract's deposit restriction blocks sponsor funding use case |

### RCA-4: No Database Transaction Boundaries

| Dimension | Analysis |
|-----------|----------|
| **Problem** | Financial operations perform multiple sequential DB writes without transactions. Partial failure = inconsistent state. |
| **Root Cause** | Supabase JS client doesn't natively support multi-statement transactions. Team used RPCs for some ops but TypeScript layer above doesn't coordinate atomically. |
| **Architectural Origin** | Supabase choice provides excellent DX but limits transaction control. PostgreSQL transactions require raw SQL via `supabase.rpc()` or direct connection (unavailable in serverless without pooling). |
| **Documents to Update** | `funding.service.ts`, `disbursement.service.ts`, `refund.service.ts`, new migration for RPCs |
| **Modules Affected** | All financial services, repository layer |
| **Roles Impacted** | All financial actors (Organizer, Sponsor, Winner) |
| **Business Impact** | 🔴 Escrow state and transaction records can become inconsistent |
| **Security Impact** | 🟠 Inconsistent state could be exploited for unauthorized withdrawals |
| **Scalability Impact** | Medium — RPCs are single-connection, but within Postgres capacity |
| **Blockchain Impact** | 🟠 DB state diverging from on-chain truth |


### RCA-5: Permission Engine Incompleteness

| Dimension | Analysis |
|-----------|----------|
| **Problem** | `PermissionEngine` defines rules for 3/10 roles. Other roles return `false` for all actions. Legacy `requireEventRole` provides actual enforcement inconsistently. |
| **Root Cause** | Incomplete refactoring. Engine built with correct interface but permission matrix never populated. Legacy system hides the gap (no visible breakage). |
| **Architectural Origin** | Two competing auth systems were never consolidated. Dual-system means different routes enforce different rules. |
| **Documents to Update** | `permission-engine.ts`, `authorize.ts`, all route handlers, `lib/auth/permissions.ts` (deprecate) |
| **Modules Affected** | All protected routes, all role-gated operations |
| **Roles Impacted** | WorkspaceOwner, WorkspaceAdmin, Sponsor, Mentor, Participant, TeamCaptain, TeamMember (7 roles with no PermissionEngine rules) |
| **Business Impact** | 🟠 Users may be blocked from legitimate actions or permitted unauthorized ones |
| **Security Impact** | 🟠 Inconsistent enforcement = potential bypass paths |
| **Scalability Impact** | Low — pure computation |
| **Blockchain Impact** | None |

### RCA-6: Missing User-Facing Pages

| Dimension | Analysis |
|-----------|----------|
| **Problem** | Signup, workspace creation, admin dashboard, terms, privacy pages referenced in navigation but don't exist. |
| **Root Cause** | Development prioritized complex financial workflows over basic platform pages. Assumed Supabase Auth UI for signup, but project uses custom login. |
| **Architectural Origin** | Route structure planned (links exist) but page implementation deferred. `(auth)` group only has `login`, `forgot-password`, `reset-password`. |
| **Documents to Update** | Route files to create, navigation components, footer links |
| **Modules Affected** | Auth flow, workspace management, platform administration |
| **Roles Impacted** | New users (cannot register), Platform Admin (no tools), all users (broken footer links) |
| **Business Impact** | 🔴 Platform unusable for new users — complete onboarding blocker |
| **Security Impact** | Low — missing pages don't create vulnerabilities |
| **Scalability Impact** | None |
| **Blockchain Impact** | None |

### RCA-7: Domain Event Publisher Loses Events

| Dimension | Analysis |
|-----------|----------|
| **Problem** | `publishDomainEvent` catches all errors and logs them. Audit records can be silently lost. Event bus `publish()` does not await `Promise.allSettled`. |
| **Root Cause** | Fire-and-forget design for performance. Two competing event systems: `eventBus` (in-memory, no subscribers registered) and `publishDomainEvent` (inline processing with error swallowing). |
| **Architectural Origin** | Events designed as non-blocking side effects. For a financial platform, audit loss is unacceptable but wasn't initially treated as critical. |
| **Documents to Update** | `lib/events/publisher.ts`, `lib/domain/events.ts`, new migration for outbox table |
| **Modules Affected** | All services that publish events, audit system, notification system |
| **Roles Impacted** | All — audit trail affects compliance and dispute resolution |
| **Business Impact** | 🟠 Lost audit records could invalidate dispute evidence |
| **Security Impact** | 🟠 Missing audit trail hides malicious activity |
| **Scalability Impact** | Low — outbox pattern scales linearly with write volume |
| **Blockchain Impact** | None directly — but on-chain tx records supplement lost DB audit |


### RCA-8: Insufficient Test Coverage

| Dimension | Analysis |
|-----------|----------|
| **Problem** | ~20 test files for a financial platform. 0% coverage on API routes, KMS, idempotency, permission engine, wallet verification, notification service, Stellar chain adapter. |
| **Root Cause** | Development velocity prioritized over test-driven development. Property-based tests on state machines show the team knows how to test well — they simply didn't have time to extend coverage. |
| **Architectural Origin** | No CI gate on minimum coverage. Test infrastructure (Vitest, fast-check, Playwright) is properly configured — just underutilized. |
| **Documents to Update** | Test files to create, CI configuration, coverage thresholds |
| **Modules Affected** | All modules — testing is cross-cutting |
| **Roles Impacted** | Development team (confidence), all users (regression risk) |
| **Business Impact** | 🟠 High regression risk on any code change |
| **Security Impact** | 🟠 Security-critical paths untested (auth bypass could exist undetected) |
| **Scalability Impact** | Low — tests are development-time |
| **Blockchain Impact** | 🟠 Soroban contract tests missing — on-chain bugs are irreversible |

---


## Part 2: Complete Issue Resolution Plan

### Critical Issues (C1–C8): Must Fix Before Any Live Usage

---

#### C1: Double-Disbursement Race Condition

**Problem**: Concurrent disbursement calls pay winners twice.

**Risks if Unfixed**: Financial loss, escrow overdraft, legal liability, irreversible on-chain transactions.

**Recommended Solution**: PostgreSQL advisory lock + atomic status transition guard via RPC.

```sql
CREATE OR REPLACE FUNCTION begin_disbursement(p_event_id uuid, p_actor_id uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_lock_acquired boolean;
BEGIN
  SELECT pg_try_advisory_xact_lock(hashtext(p_event_id::text)) INTO v_lock_acquired;
  IF NOT v_lock_acquired THEN RETURN false; END IF;
  UPDATE escrow_accounts
    SET state = 'PendingRelease', version = version + 1
    WHERE event_id = p_event_id AND state IN ('Locked', 'FullyFunded')
    RETURNING true INTO v_lock_acquired;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN true;
END; $$;
```

**Alternative Solutions Considered**:
1. Redis SETNX distributed lock — requires new infra dependency. Overkill for single-DB architecture. Rejected.
2. Optimistic locking on winners table — still has TOCTOU window between read and update. Rejected.
3. Queue-based disbursement — best long-term, deferred to Phase 5.

**Required Changes**: New migration, modify `DisbursementService`, add `abort_disbursement` RPC, add `complete_disbursement` RPC.

**Risks of Implementation**: Advisory lock auto-releases on session end (safe). Migration is additive (no rollback risk).

**Acceptance Criteria**:
- [ ] Concurrent disbursement test: 100 parallel requests, exactly 1 succeeds
- [ ] Second caller receives 409 Conflict with clear message
- [ ] Failed disbursement resets escrow state atomically
- [ ] Integration test proves mutual exclusion

---


#### C2: No Rate Limiting

**Problem**: All endpoints vulnerable to brute-force and API abuse.

**Recommended Solution**: Upstash Redis sliding-window rate limiting integrated at middleware level.

| Endpoint Pattern | Limit | Window | Key |
|-----------------|-------|--------|-----|
| `/api/auth/*` | 5 | 60s | IP |
| `/api/events/*/disburse` | 2 | 300s | userId |
| `/api/events/*/refund` | 2 | 300s | userId |
| `/api/events/*/fund` | 5 | 60s | userId |
| `/api/events` (POST) | 10 | 60s | userId |
| `/api/*` (authenticated) | 60 | 60s | userId |
| `/api/*` (anonymous) | 30 | 60s | IP |
| `/api/wallets/*/challenge` | 10 | 60s | IP |

**Alternative Solutions**: Vercel Edge Config (vendor lock-in, rejected), In-memory Map (doesn't survive cold starts, rejected), Cloudflare WAF (external dependency, rejected).

**Required Changes**: Add `@upstash/ratelimit`, `@upstash/redis` deps. Create `lib/rate-limit.ts`. Integrate into `middleware.ts`. Add env vars.

**Acceptance Criteria**:
- [ ] Auth endpoints reject after 5 attempts/min/IP with 429
- [ ] Financial endpoints limited to 2/5min/user
- [ ] 429 response includes `Retry-After` header
- [ ] Health check endpoints bypass rate limiting
- [ ] In-memory LRU fallback if Redis unavailable (degraded but functional)

---

#### C3: Missing Signup Page

**Problem**: Platform unusable for new users — no registration path exists.

**Recommended Solution**: Create `web/app/(auth)/signup/page.tsx` with email/password/name/terms flow using Supabase `auth.signUp()`.

**Required Changes**: New page file, shared auth layout, email confirmation callback handling, terms checkbox, link from login page.

**Acceptance Criteria**:
- [ ] Register with email + password + display name
- [ ] Email confirmation required before first login
- [ ] Terms acceptance recorded in user_metadata
- [ ] Duplicate email shows clear error (not generic failure)
- [ ] Password minimum 8 chars enforced
- [ ] Page supports dark mode (CSS variables only)
- [ ] Mobile responsive
- [ ] Link to login page ("Already have an account?")

---

#### C4: Soroban Contract Partial-Disburse Bug

**Problem**: `disburse()` transitions to `Released` after first batch call. Multi-batch (>100 winners) impossible.

**Recommended Solution (Phase 1)**: Accept Horizon as execution layer, Soroban as state tracking. Document via ADR. Backend already uses Horizon for actual transfers.

**Recommended Solution (Phase 4)**: Redesign contract: split `disburse()` into `disburse_batch()` (no state change) + `finalize()` (transitions to Released). Add `DisbursedTotal` counter.

**Acceptance Criteria (Phase 1)**:
- [ ] ADR documents architecture decision
- [ ] Backend disbursement works with >100 winners via Horizon batches
- [ ] Contract state updated post-disbursement via `finalize()` equivalent

**Acceptance Criteria (Phase 4)**:
- [ ] Contract supports multiple disburse_batch calls without state transition
- [ ] finalize() only callable by admin after all batches complete
- [ ] DisbursedTotal accurately tracks cumulative payouts

---


#### C5: Backend/Contract State Mismatch (9 vs 6 states)

**Problem**: Backend has 9 escrow states, contract has 6. Three backend-only states (`Failed`, `Cancelled`, `PendingRelease`) have no contract equivalent.

**Recommended Solution**: Formalize the state mapping as an architectural constant. Backend states are a superset of contract states. The extra states represent backend-only concerns (failure recovery, mutex, cancellation workflow).

**State Mapping Table**:
| Backend State | Contract State | Sync Direction |
|--------------|---------------|----------------|
| PendingFunding | PendingFunding (0) | Backend → Contract (init) |
| PartiallyFunded | PartiallyFunded (1) | Reconciliation compares |
| FullyFunded | FullyFunded (2) | Reconciliation compares |
| Locked | Locked (3) | Backend calls `contract.lock()` |
| PendingRelease | Locked (3) | Backend-only (mutex state) |
| Released | Released (4) | Backend calls `contract.finalize()` |
| Refunded | Refunded (5) | Backend calls `contract.refund()` |
| Failed | N/A | Backend-only (recovery) |
| Cancelled | Refunded (5) | Backend triggers refund first |

**Acceptance Criteria**:
- [ ] `BACKEND_TO_CONTRACT_STATE_MAP` constant in codebase
- [ ] Reconciliation service compares both states, flags divergence
- [ ] ADR explains why superset is acceptable
- [ ] No code path assumes 1:1 state equivalence

---

#### C6: Deposit Auth Mismatch (contract: organizer-only; backend: any wallet)

**Problem**: Contract `deposit()` requires organizer auth. Backend supports sponsor deposits from any verified wallet.

**Recommended Solution (Phase 1)**: Deposits use Horizon direct transfers to escrow public key (bypasses contract). This is already the actual implementation — formalize it.

**Recommended Solution (Phase 4)**: Add `admin_deposit(from: Address, amount: i128)` to contract — platform admin authorizes, sender confirms.

**Acceptance Criteria**:
- [ ] Sponsor deposits work via Horizon (existing behavior documented)
- [ ] Reconciliation verifies on-chain balance matches sum of DB deposits
- [ ] Contract deposit method usage documented as "organizer self-fund only"

---

#### C7: No MFA for Financial Operations

**Problem**: Mainnet disbursement/refund triggerable with session token alone.

**Recommended Solution**: Supabase TOTP MFA with AAL2 enforcement on financial endpoints.

**Implementation Flow**:
1. User enrolls MFA in Settings (QR code + backup codes)
2. Financial endpoints check `auth.mfa.getAuthenticatorAssuranceLevel()`
3. If `currentLevel !== 'aal2'`, return 403 with "MFA verification required"
4. Testnet operations exempt (developer convenience)

**Acceptance Criteria**:
- [ ] MFA enrollment flow in Settings page
- [ ] Mainnet financial endpoints reject non-AAL2 sessions
- [ ] Testnet operations work without MFA
- [ ] Backup codes generated and shown once during enrollment
- [ ] Session AAL verified server-side

---

#### C8: No Database Transaction Boundaries

**Problem**: Financial ops (fund, disburse, refund) partially commit on failure.

**Recommended Solution**: PostgreSQL RPC functions that encapsulate multi-step operations in implicit transactions.

**Required RPCs**:
1. `rpc_confirm_funding` — escrow state + transaction + audit atomically
2. `rpc_record_disbursement_batch` — winner status + transaction + audit atomically
3. `rpc_record_refund` — escrow state + transaction + audit atomically
4. `begin_disbursement` / `abort_disbursement` / `complete_disbursement` — mutex lifecycle

**Acceptance Criteria**:
- [ ] Funding confirmation atomic (all-or-nothing)
- [ ] Disbursement recording atomic per batch
- [ ] Refund recording atomic
- [ ] Failure at any step rolls back entire operation
- [ ] TypeScript services call RPCs via `supabase.rpc()`

---


### High Priority Issues (H1–H10): Must Fix Before Beta Users

---

#### H1: PermissionEngine Only Covers 3/10 Roles

**Solution**: Complete the RBAC matrix. Implement ABAC validators for contextual rules.

**Full Matrix** (abbreviated — see implementation for complete version):
- PlatformAdmin: CRUD on all resources
- WorkspaceOwner: CRUD on workspace-scoped resources
- Organizer: CRU on event + escrow, CRUD on disputes
- Judge: Read submissions (assigned only), CRUD evaluations (own only)
- Participant: CRUD own submissions/teams, Create disputes
- Sponsor: Read events + escrow
- Mentor: Read events + submissions + teams
- TeamCaptain: CRU own team
- TeamMember: Read own team

**Acceptance Criteria**:
- [ ] All 10 roles have rules in `permission-engine.ts`
- [ ] ABAC validators: judge assignment, event state, ownership
- [ ] Legacy helpers deprecated with `@deprecated` JSDoc
- [ ] Integration test: 10 roles × 12 resources × 6 actions

---

#### H2: Login Page Dark Mode

**Solution**: Replace hardcoded Tailwind color classes with CSS variables.

**Acceptance Criteria**:
- [ ] No `bg-neutral-*`, `text-neutral-*` hardcoded classes
- [ ] Dark mode toggles correctly
- [ ] Fix deprecated `FormEvent` import

---

#### H3: Domain Event Publisher Loses Events

**Solution**: Transactional outbox pattern. Events written to `domain_events` table atomically with business operation. Background processor handles delivery.

**Acceptance Criteria**:
- [ ] Events persisted in same transaction as triggering operation
- [ ] Background processor (`/api/cron/process-events`) every 1 min
- [ ] Retry up to 5 times with exponential backoff
- [ ] Alert on permanently failed events
- [ ] Audit records never silently lost

---

#### H4: No Duplicate Winner Constraint

**Solution**: `ALTER TABLE winners ADD CONSTRAINT winners_event_recipient_unique UNIQUE (event_id, recipient_id);`

**Acceptance Criteria**:
- [ ] Constraint exists
- [ ] API returns 409 on duplicate
- [ ] Existing data validated (no duplicates should exist)

---

#### H5: Team Prize Splitting

**Solution**: Add `prize_split_policy` to events (captain_receives | equal_split | custom). Disbursement service checks policy and pays team members accordingly.

**Acceptance Criteria**:
- [ ] Policy selectable in event creation wizard (Step 3)
- [ ] Disbursement correctly splits for `equal_split`
- [ ] Individual "held" status per team member without wallet
- [ ] UI shows per-member allocation in winners page

---

#### H6: Missing Terms/Privacy Pages

**Solution**: Create `web/app/(public)/terms/page.tsx` and `privacy/page.tsx` as static content pages.

**Acceptance Criteria**:
- [ ] Accessible without auth
- [ ] Footer links resolve correctly
- [ ] Content covers: data handling, escrow terms, dispute process, Stellar wallet data

---

#### H7: Wallet Removal Without Escrow Check

**Solution**: New API route `DELETE /api/wallets/[id]` that checks `winners` table and `escrow_accounts.funding_wallet` before allowing removal.

**Acceptance Criteria**:
- [ ] Cannot remove wallet while pending winner destination
- [ ] Cannot remove wallet while active escrow funding source
- [ ] 409 with explanation if blocked
- [ ] User directed to complete pending operations

---

#### H8: No Disbursement Retry

**Solution**: Mirror `RefundService` retry pattern (3 retries, exponential backoff). On final failure, mark affected winners as `held` with reason.

**Acceptance Criteria**:
- [ ] Each batch retried up to 3 times (1s, 2s, 4s)
- [ ] Successful batches recorded, failed batches held
- [ ] Organizer notified of partial failure

---

#### H9: Registration Deadline Auto-Enforcement

**Solution**: Cron job (`/api/cron/transitions`) every 5 min checks for events past deadline and transitions state.

**Acceptance Criteria**:
- [ ] Events auto-transition RegistrationOpen → RegistrationClosed
- [ ] Optimistic lock prevents race with manual transitions
- [ ] Audit record for auto-transitions

---

#### H10: Stellar Account Minimum Reserve

**Solution**: Validate in `validatePrizeAllocation()` that escrow retains 1 XLM base reserve + estimated tx fees after disbursement.

**Acceptance Criteria**:
- [ ] Validation deducts reserve from disbursable balance
- [ ] Clear error shows available vs requested amounts
- [ ] Fee estimation accounts for batch count × base fee

---


### Medium Priority Issues (M1–M10): Fix Before Public Launch

| # | Issue | Solution Summary | Effort |
|---|-------|-----------------|--------|
| M1 | No workspace creation page | Create simple form at `/workspaces/new` | 4h |
| M2 | No admin dashboard | Create `/admin` with user mgmt + event moderation + audit viewer | 12h |
| M3 | No email sending configured | Wire Resend with templates for key lifecycle events | 8h |
| M4 | Deprecated `FormEvent` | Replace with `React.FormEvent<HTMLFormElement>` across codebase | 1h |
| M5 | No CAPTCHA on auth | Add Cloudflare Turnstile to login/signup | 4h |
| M6 | Numeric columns lack precision | Migrate to `numeric(20,7)` for all financial columns | 2h |
| M7 | No tie-breaking logic | Add tiebreaker criteria (submission time, then random seed) | 4h |
| M8 | Dispute blocks indefinitely | Add auto-dismiss deadline (configurable, default 14 days) | 3h |
| M9 | No account deletion (GDPR) | Settings flow: soft-delete → 30-day grace → hard purge | 6h |
| M10 | TeamFormationLocked naming confusion | Rename to `TeamFormationOpen` in state machine + DB | 2h |

---


## Part 3: User Journey Validation

### Journey 1: Visitor → Registered User → Active Participant

| Step | Status Before | Status After | Fix Reference |
|------|--------------|-------------|---------------|
| 1. Land on homepage | ✅ Working | ✅ + trust signals, escrow diagram | Phase 6 |
| 2. Click "Get Started" | ❌ Dead link | ✅ Routes to `/signup` | C3 |
| 3. Fill signup form | ❌ Page missing | ✅ Name + email + password + terms | C3 |
| 4. Receive confirmation email | ❌ | ✅ Supabase email confirm + Resend template | M3 |
| 5. Confirm email → redirect to dashboard | ❌ | ✅ Auth callback handles | C3 |
| 6. See onboarding checklist | ❌ | ✅ "Connect wallet → Create/join workspace → Create/join event" | Phase 6 |
| 7. Connect Freighter wallet | ✅ Working | ✅ No change | — |
| 8. Browse public events | ✅ Working | ✅ No change | — |
| 9. Register for event | ✅ Working | ✅ + capacity indicator | Phase 6 |
| 10. Join/create team | ✅ Working | ✅ + size indicator | Phase 6 |
| 11. Submit project | ✅ Working | ✅ + drag-drop + version history | Phase 6 |
| 12. File dispute (if needed) | ✅ Working | ✅ + evidence upload + deadline | H3/M8 |
| 13. Receive prize | ✅ Working | ✅ + team split + retry | H5/H8 |

**Validation**: ✅ Complete flow — no dead ends post-remediation.

**Recovery Paths**:
- Forgot password → existing flow ✅
- Email not received → resend link on signup confirmation screen
- Wallet connection fails → retry with clear error message ✅
- Team full → "Request to join" UI with pending state ✅

---

### Journey 2: Organizer Full Lifecycle

| Step | Status Before | Status After | Fix Reference |
|------|--------------|-------------|---------------|
| 1. Create workspace | ⚠️ No page | ✅ Simple form at `/workspaces/new` | M1 |
| 2. Configure workspace | ⚠️ Basic | ✅ Name + slug + description | M1 |
| 3. Create event (4-step wizard) | ✅ | ✅ + prize split + discard draft + template import | H5/Phase 6 |
| 4. Configure timeline | ✅ | ✅ No change | — |
| 5. Assign judges | ✅ | ✅ No change | — |
| 6. Fund escrow | ✅ | ✅ + reserve check + precision + fee accounting | H10/M6 |
| 7. Publish event | ✅ | ✅ No change | — |
| 8. Registration auto-closes | ❌ Not implemented | ✅ Cron-driven | H9 |
| 9. Lock team formation | ✅ | ✅ (state renamed from TeamFormationLocked to TeamFormationOpen) | M10 |
| 10. Open submissions | ✅ | ✅ No change | — |
| 11. Close submissions | ✅ | ✅ No change | — |
| 12. Monitor judging progress | ⚠️ No indicator | ✅ Progress bar (X of Y evaluated) | Phase 6 |
| 13. Finalize judging | ✅ | ✅ No change | — |
| 14. Dispute window opens | ✅ | ✅ + auto-deadline | M8 |
| 15. Resolve disputes | ✅ | ✅ + evidence UI | Phase 6 |
| 16. Approve winners | ✅ | ✅ No change | — |
| 17. Trigger disbursement | ⚠️ Race condition | ✅ + mutex + retry + MFA (mainnet) | C1/H8/C7 |
| 18. View transaction proof | ✅ | ✅ + Stellar Expert links | Phase 6 |
| 19. Event complete | ✅ | ✅ No change | — |

**Validation**: ✅ Full lifecycle complete with all protections.

---

### Journey 3: Sponsor Funding

| Step | Status Before | Status After |
|------|--------------|-------------|
| 1. Receive invitation | ✅ | ✅ |
| 2. Accept invitation | ✅ | ✅ |
| 3. View event details | ✅ | ✅ |
| 4. Fund escrow (Horizon transfer) | ✅ | ✅ + precision + fee deduction |
| 5. See funding confirmation | ✅ | ✅ + on-chain verification |
| 6. View dashboard of sponsored events | ❌ Missing | ✅ Sponsor dashboard (Phase 6) |

---

### Journey 4: Judge Evaluation

| Step | Status Before | Status After |
|------|--------------|-------------|
| 1. Receive invitation | ✅ | ✅ |
| 2. Accept | ✅ | ✅ |
| 3. View assigned submissions | ⚠️ No assignment filter | ✅ ABAC enforced — sees only assigned | H1 |
| 4. Score submission (rubric) | ✅ | ✅ |
| 5. Declare conflict of interest | ✅ | ✅ |
| 6. Save draft | ✅ | ✅ |
| 7. Submit final scores | ✅ | ✅ |

**Validation**: ✅ Complete with ABAC enforcement.

---

### Journey 5: Platform Admin Operations

| Step | Status Before | Status After |
|------|--------------|-------------|
| 1. Access admin dashboard | ❌ No page | ✅ `/admin` with metrics + user mgmt | M2 |
| 2. View all users | ❌ | ✅ Searchable table |
| 3. Suspend/unsuspend user | ❌ | ✅ Admin action |
| 4. View all events | ⚠️ | ✅ Filterable list |
| 5. Moderate content | ❌ | ✅ Flagging + removal |
| 6. View audit log | ❌ UI-only | ✅ Searchable audit viewer |
| 7. Monitor escrow health | ⚠️ Cron only | ✅ Dashboard widget with reconciliation status |
| 8. Reconcile manually | ⚠️ | ✅ Admin trigger button |

---


## Part 4: Role Validation

### Platform Admin
| Capability | Before | After |
|-----------|--------|-------|
| View platform metrics | ❌ | ✅ Admin dashboard |
| Manage users (CRUD) | ❌ | ✅ User table with actions |
| Moderate events | ❌ | ✅ Flag/suspend/remove |
| View audit trail | API only | ✅ UI viewer |
| Trigger reconciliation | ❌ | ✅ Manual trigger |
| Override event state | ⚠️ | ✅ Via PermissionEngine |
| Resolve escalated disputes | ⚠️ | ✅ Admin dispute resolution |

### Workspace Owner
| Capability | Before | After |
|-----------|--------|-------|
| Create workspace | ⚠️ No page | ✅ `/workspaces/new` |
| Manage members | ✅ | ✅ No change |
| Configure settings | ⚠️ | ✅ Settings page |
| Delete workspace | ❌ (what happens to events?) | ✅ Only if no active events (RESTRICT) |
| Transfer ownership | ❌ | ✅ Transfer to another admin |
| View workspace analytics | ❌ | Deferred (nice-to-have) |

### Organizer
| Capability | Before | After |
|-----------|--------|-------|
| Full event lifecycle | ✅ | ✅ + all fixes (mutex, MFA, retry) |
| Assign mentors | ⚠️ No UI | ✅ Mentor assignment UI |
| Preview as participant | ❌ | ✅ Preview mode link |
| Export data | ⚠️ API only | ✅ UI button triggers export |
| Duplicate event | ❌ | ✅ Template system (Phase 6) |

### Sponsor
| Capability | Before | After |
|-----------|--------|-------|
| Fund escrow | ✅ | ✅ + precision + fees |
| View funding status | ✅ | ✅ |
| View event progress | ✅ | ✅ |
| Sponsor dashboard | ❌ | ✅ Phase 6 |
| Withdraw sponsorship (before lock) | ❌ | ✅ Refund path before lock |

### Judge
| Capability | Before | After |
|-----------|--------|-------|
| See assigned submissions only | ⚠️ Sees all | ✅ ABAC filtered |
| Score with rubric | ✅ | ✅ |
| Conflict of interest flag | ✅ | ✅ |
| View other judges' scores | ❌ (after finalization) | ✅ Post-finalization only |

### Mentor
| Capability | Before | After |
|-----------|--------|-------|
| View teams | ⚠️ Role exists, no UI | ✅ Team viewer for mentors |
| Comment on submissions | ❌ | ✅ Phase 6 (comments system) |
| View event timeline | ✅ | ✅ |
| Mentor-specific dashboard | ❌ | ✅ Assigned teams view |

### Team Captain
| Capability | Before | After |
|-----------|--------|-------|
| Create team | ✅ | ✅ |
| Accept/reject join requests | ✅ | ✅ |
| Remove member | ⚠️ No endpoint | ✅ Captain can remove |
| Transfer captaincy | ❌ | ✅ H5 (Phase 2) |
| Submit on behalf of team | ✅ | ✅ |

### Participant (non-captain)
| Capability | Before | After |
|-----------|--------|-------|
| Join team | ✅ | ✅ |
| Leave team | ⚠️ | ✅ Explicit leave action |
| View own submission | ✅ | ✅ |
| File dispute | ✅ | ✅ + evidence upload |
| Withdraw application | ❌ | ✅ Phase 6 |

### Reviewer (if applicable)
Currently no separate Reviewer role — evaluations are done by Judges. If future need arises, it would be a subset of Judge permissions without scoring authority.

### Guest (unauthenticated)
| Capability | Before | After |
|-----------|--------|-------|
| View landing page | ✅ | ✅ |
| Browse events (discover) | ✅ | ✅ |
| View event detail (public) | ✅ | ✅ |
| View terms/privacy | ❌ Broken links | ✅ H6 |
| Register | ❌ No page | ✅ C3 |

---


## Part 5: Blockchain & Smart Contract Validation

### Contract Deployment
| Check | Status | Remediation |
|-------|--------|-------------|
| Deployment script exists | ✅ `web/scripts/deploy-contract.ts` | — |
| Per-event contract deployment | ❌ Single shared contract | Phase 4: factory pattern |
| Contract ID stored per-event | ❌ Global env var | Phase 4: `escrow_accounts.contract_id` column |
| Deployment authorization | ✅ Platform keypair | — |
| TTL management on deploy | ⚠️ Only in `initialize()` | Phase 4: refresh in all write methods |

### Escrow Creation
| Check | Status | Remediation |
|-------|--------|-------------|
| KMS encryption of secret key | ✅ Fixed | — |
| Account creation on Stellar | ✅ | — |
| Minimum funding (1 XLM reserve) | ⚠️ Not checked | H10: validate before disburse |
| Contract initialization | ✅ `initializeEscrow()` | — |
| Error handling on Horizon failure | ⚠️ Throws generic | Improve error typing |

### Funding
| Check | Status | Remediation |
|-------|--------|-------------|
| On-chain tx verification | ✅ Horizon lookup | — |
| Amount precision (stroops) | ⚠️ `numeric` no precision | M6: `numeric(20,7)` |
| Duplicate tx_hash rejection | ✅ UNIQUE constraint | — |
| Balance reconciliation | ✅ But not scheduled | Phase 2: cron every 30 min |
| Fee deduction from expected_balance | ❌ | Phase 2: fee accounting |
| Sponsor deposit (any wallet) | ✅ Via Horizon (not contract) | Document in ADR |

### Deposit Verification
| Check | Status | Remediation |
|-------|--------|-------------|
| Transaction confirmation on-chain | ✅ | — |
| Source account matches funding_wallet | ✅ | — |
| Amount matches claimed deposit | ✅ | — |
| Network matches (testnet/mainnet) | ✅ `guardCrossNetwork()` | — |
| Idempotency (same tx not counted twice) | ✅ tx_hash UNIQUE | — |

### Wallet Ownership Verification
| Check | Status | Remediation |
|-------|--------|-------------|
| Challenge-response flow | ✅ | — |
| Nonce expiry (5 min) | ✅ | — |
| Stellar `Keypair.verify()` | ✅ | — |
| Network mismatch prevention | ✅ | — |
| Multiple wallets per user | ✅ | — |
| Primary wallet designation | ❌ Missing | Phase 6: set primary wallet |

### Milestone Approval
| Check | Status | Remediation |
|-------|--------|-------------|
| Milestone API exists | ✅ `/api/events/[id]/milestones` | — |
| Approval workflow | ⚠️ API exists, unclear if full flow | Phase 2: complete milestone UI |
| State transition on milestone complete | ⚠️ | Phase 2: wire to event lifecycle |

### Judge Quorum
| Check | Status | Remediation |
|-------|--------|-------------|
| Minimum judges per submission | ❌ Not enforced | Phase 2: configurable quorum |
| Quorum check before finalization | ❌ | Phase 2: precondition in state machine |
| All assigned submissions evaluated | ⚠️ Not validated | Phase 2: completeness check |

### Organizer Approval (winner verification)
| Check | Status | Remediation |
|-------|--------|-------------|
| State gate (WinnerVerification → PrizeApproved) | ✅ | — |
| Organizer role check | ✅ | — |
| Approval persisted | ✅ | — |

### Dispute Handling
| Check | Status | Remediation |
|-------|--------|-------------|
| Dispute blocks disbursement | ✅ `isDisbursementBlocked()` | — |
| Only during DisputeWindow state | ✅ | — |
| Resolution by organizer/admin | ✅ | — |
| Auto-dismiss deadline | ❌ Missing | M8: 14-day default |
| Escalation path | ❌ Missing | Phase 3: escalate to Platform Admin |
| Evidence upload | ⚠️ Table exists, no UI | Phase 6: evidence upload |

### Tranche Release
| Check | Status | Remediation |
|-------|--------|-------------|
| Multi-recipient batch payments | ✅ MAX_OPS_PER_TX=100 | — |
| Batch splitting for >100 winners | ✅ Backend handles | — |
| Contract supports multi-batch | ❌ Transitions to Released | C4: finalize() pattern |
| Per-batch transaction recording | ✅ | — |

### Multi-Recipient Payouts
| Check | Status | Remediation |
|-------|--------|-------------|
| Batched payment operations | ✅ | — |
| Individual winner status tracking | ✅ per winner record | — |
| Held winners (no wallet) | ✅ `disbursement_status: "held"` | — |
| Team prize splitting | ❌ No split logic | H5: prize_split_policy |

### Refunds
| Check | Status | Remediation |
|-------|--------|-------------|
| Full refund to funding_wallet | ✅ | — |
| Retry with exponential backoff | ✅ 3 retries | — |
| Partial refund (after partial disburse) | ❌ | Phase 4: calculate remaining |
| State transition on success | ✅ → Refunded | — |
| Notification on failure | ✅ | — |

### Event Cancellation
| Check | Status | Remediation |
|-------|--------|-------------|
| Cancellation triggers refund | ✅ State machine | — |
| Cancel after partial disbursement | ❌ No recovery | Phase 4: partial refund |
| Participant notification | ✅ Via domain events | — |
| Cancellation reason recorded | ⚠️ | Phase 2: add reason field |

### Audit Trail
| Check | Status | Remediation |
|-------|--------|-------------|
| Immutable (trigger blocks UPDATE/DELETE) | ✅ | — |
| All financial ops create audit records | ✅ | — |
| tx_hash stored | ✅ | — |
| Actor ID stored | ✅ | — |
| Outbox guarantees delivery | ❌ Fire-and-forget | H3: transactional outbox |

### Transaction Confirmations
| Check | Status | Remediation |
|-------|--------|-------------|
| Polling for Soroban tx (30 attempts × 2s) | ✅ | — |
| Horizon tx verification | ✅ | — |
| Timeout handling | ✅ Returns `{ success: false }` | — |
| Stuck transaction recovery | ⚠️ | Phase 5: manual retry mechanism |

### Failure Recovery
| Check | Status | Remediation |
|-------|--------|-------------|
| KMS unavailable | ✅ Aborts with notification | — |
| Horizon down during funding verify | ⚠️ Error thrown, no retry | Phase 2: retry queue |
| Horizon down during disbursement | ⚠️ Disbursement has no retry | H8: add retry |
| DB unavailable mid-disbursement | ❌ Funds sent, DB not updated | C8: transaction boundaries |
| Process crash during event publish | ❌ Event lost | H3: outbox pattern |

### Replay Protection
| Check | Status | Remediation |
|-------|--------|-------------|
| tx_hash UNIQUE constraint | ✅ | — |
| Idempotency keys table | ✅ | — |
| SHA-256 body hash comparison | ✅ | — |
| Sequence number on Stellar txs | ✅ (inherent to Stellar) | — |

### Double-Spend Protection
| Check | Status | Remediation |
|-------|--------|-------------|
| tx_hash uniqueness prevents double-record | ✅ | — |
| Concurrent disbursement mutex | ❌ Missing | C1: advisory lock |
| Escrow state gate (only disburse from Locked) | ✅ | — |
| Optimistic concurrency on escrow | ✅ version column | — |

### Idempotency
| Check | Status | Remediation |
|-------|--------|-------------|
| Key storage + dedup | ✅ | — |
| 24h TTL | ✅ | — |
| Cleanup cron | ❌ Not scheduled | Phase 2: daily cron |
| Response replay on conflict | ✅ | — |

---


## Part 6: UI/UX Improvement Plan

### Page-by-Page Recommendations

#### Landing Page (`web/app/page.tsx`)
| Aspect | Current | Recommended |
|--------|---------|-------------|
| Navigation | ✅ Single-line | No change |
| Hero | ✅ Clean, no AI-slop | Add animated escrow flow diagram |
| Social proof | ❌ Missing | Add event count, total XLM disbursed, participant stats |
| How it works | ✅ | Add visual escrow lifecycle diagram |
| CTA | ✅ | No change |
| Trust signals | ❌ | Add "Funds secured by Stellar blockchain escrow" badge |
| Mobile | ✅ Responsive | No change |
| Loading/Error | N/A (SSR) | No change |

#### Login Page (`web/app/(auth)/login/page.tsx`)
| Aspect | Current | Recommended |
|--------|---------|-------------|
| Dark mode | ❌ Hardcoded colors | Replace with CSS variables |
| Layout | ✅ | No change |
| Error states | ✅ | No change |
| OAuth | ❌ | Phase 6: Google + GitHub buttons |
| Link to signup | ❌ | Add footer link |
| CAPTCHA | ❌ | Phase 3: Turnstile |
| Mobile | ⚠️ Fixed width | Fix to max-w with padding |

#### Signup Page (NEW)
| Aspect | Specification |
|--------|---------------|
| Fields | display_name, email, password, confirm_password, terms_checkbox |
| Layout | Centered card matching login |
| Validation | Real-time client + Supabase server |
| Success state | "Check your email" confirmation screen |
| Back link | "Already have an account? Sign in" |
| Mobile | Responsive, inputs full-width |

#### Dashboard (`web/app/(app)/dashboard/page.tsx`)
| Aspect | Current | Recommended |
|--------|---------|-------------|
| Layout | ✅ | Add onboarding checklist for new users |
| Metrics | ✅ Quick actions | Add "Events needing attention" urgency list |
| Notifications | ⚠️ Bell only | Inline last 5 notifications |
| Empty state | ✅ "Get started" | Enhance with step-by-step guide |

#### Create Event Wizard (`web/app/(app)/events/new/page.tsx`)
| Aspect | Current | Recommended |
|--------|---------|-------------|
| Draft persistence | ✅ localStorage | Add "Discard draft" button |
| Prize config | ✅ | Add prize_split_policy selector |
| Template import | ❌ | "Import from template" option |
| USD equivalent | ❌ | Show estimated USD via price oracle |
| Eligibility | ❌ | Simple text field (Step 2) |
| Mainnet warning | ⚠️ Basic | Add mandatory confirmation checkbox |

#### Event Detail (`web/app/(app)/events/[id]/page.tsx`)
| Aspect | Current | Recommended |
|--------|---------|-------------|
| Breadcrumbs | ❌ | Add: Dashboard > Events > [Title] |
| Progress | ⚠️ Lifecycle stepper | Add funding %, eval completion %, team count |
| Preview mode | ❌ | "View as participant" link for organizers |
| Escrow status | ⚠️ | Prominent trust banner with verify link |
| Mobile | ⚠️ | Verify tab navigation works on small screens |

#### Teams Page
| Aspect | Recommendation |
|--------|---------------|
| Empty state | "Create a team" CTA for unaffiliated participants |
| Team size | Show "3/5 members" indicator |
| Captain badge | Visual indicator next to captain name |
| Join requests | Notification badge for captains |
| Leave action | Explicit button with confirmation |

#### Submissions Page
| Aspect | Recommendation |
|--------|---------------|
| File upload | Drag-and-drop dropzone |
| Version history | Accordion with timestamps |
| Edit flow | Clear "Edit submission" for pre-deadline resubmission |
| Completeness | Progress indicator (title ✓, files ✓, description ✓) |

#### Winners Page
| Aspect | Recommendation |
|--------|---------------|
| Status badges | paid ✓, held ⏳, pending ○, failed ✗ |
| Disburse button | Confirmation dialog with MFA gate (mainnet) |
| Tx links | Click to open on Stellar Expert |
| Team splits | Show per-member breakdown |

#### Disputes Page
| Aspect | Recommendation |
|--------|---------------|
| File form | Only visible during DisputeWindow state |
| Evidence | File upload + text description |
| Timeline | Visual state transitions with timestamps |
| Resolution | Form for organizer with outcome options |
| Deadline | Countdown timer showing days remaining |

#### Settings Page
| Aspect | Current | Recommended |
|--------|---------|-------------|
| MFA | ❌ | Enrollment section (QR + backup codes) |
| Sessions | ❌ | Active sessions list with revoke |
| Account deletion | ❌ | GDPR-compliant deletion flow |
| Dead code | `userId` param unused | Remove |
| Deprecated types | `FormEvent` | Fix to `React.FormEvent` |

#### Admin Dashboard (NEW)
| Section | Content |
|---------|---------|
| Metrics | Users, events, total escrow value, active disputes |
| Users | Searchable table with suspend/unsuspend actions |
| Events | Filterable list with moderation actions |
| Escrow Health | Reconciliation status, divergence alerts |
| Audit Log | Searchable viewer with actor, action, resource filters |

#### Workspace Creation (NEW)
| Field | Validation |
|-------|-----------|
| Name | Required, 3-50 chars |
| Slug | Auto-generated from name, uniqueness check |
| Description | Optional, max 500 chars |
| After creation | Redirect to workspace dashboard |

---


## Part 7: Backend Improvement Plan

### 7.1 Service Layer Refactoring

| Service | Current Issue | Target State | Priority |
|---------|--------------|--------------|----------|
| `DisbursementService` | No mutex, no retry, inline DB writes | Advisory lock + retry + RPC calls | Critical |
| `FundingService` | Inline multi-step writes | `rpc_confirm_funding` atomic | High |
| `RefundService` | Good retry, but no partial refund | Add partial refund calculation | Medium |
| `VerificationService` | Two use cases in one class | Split: `ReconciliationService` + `PublicVerificationService` | Medium |
| `publisher.ts` | Fire-and-forget | Transactional outbox insert | High |
| `notification.ts` | Direct send | Queued via outbox | Medium |
| `dispute.ts` | No deadline, no escalation | Add auto-dismiss + escalation path | Medium |

### 7.2 Domain Logic Improvements

| Area | Action | Priority |
|------|--------|----------|
| Team captain transfer | Implement `transferCaptain(teamId, newCaptainId)` | Medium |
| Team disband | Implement `disbandTeam(teamId)` with member notification | Low |
| Tie-breaking | Add `TiebreakerStrategy` (submission time, then random seed) | Medium |
| Judge quorum | Add `minimumJudgesPerSubmission` config + validation | High |
| Submission limits | Enforce `max_submissions_per_team` per event | Medium |
| Eligibility engine | Simple rule evaluation (location, experience, team size) | Low |

### 7.3 Authorization Consolidation

**Step 1**: Complete PermissionEngine with all 10 roles + ABAC validators.
**Step 2**: Create `authorize()` wrapper that calls PermissionEngine.
**Step 3**: Migrate all route handlers to use `authorize()`.
**Step 4**: Deprecate `requireEventRole`/`requireWorkspaceRole` with `@deprecated` JSDoc.
**Step 5**: Remove deprecated helpers after full migration verification.

### 7.4 Background Jobs

| Job | Schedule | Purpose | Priority |
|-----|----------|---------|----------|
| `process-events` | Every 1 min | Process domain event outbox | High |
| `transitions` | Every 5 min | Auto-close expired registrations | High |
| `reconcile` | Every 30 min | Verify on-chain escrow balances | High |
| `cleanup-idempotency` | Every 24h | Remove expired idempotency keys | Medium |
| `dispute-deadline` | Every 1h | Auto-dismiss expired disputes | Medium |
| `cleanup-domain-events` | Every 24h | Purge processed events older than 7 days | Low |

### 7.5 Logging & Monitoring

| Addition | Purpose | Priority |
|----------|---------|----------|
| Structured logging with request ID | Trace requests across services | High |
| Sentry error tracking | Automated error alerting | High |
| Financial operation alerts | Any disbursement > threshold, any tx failure | Critical |
| Stellar Horizon health check | `/api/health/stellar` | High |
| Reconciliation divergence alert | Immediate notification on mismatch | Critical |
| Rate limit exhaustion metrics | Detect potential attacks | Medium |

### 7.6 Dependency Injection Strategy

**Phase 1** (Immediate): No DI framework. Services receive dependencies via constructor params (simple factory pattern).

```typescript
// Factory creates service with all dependencies
export function createDisbursementService(deps: {
  escrowRepo: EscrowRepository;
  stellarClient: ChainAdapter;
  auditService: AuditService;
  notificationService: NotificationService;
}) {
  return new DisbursementService(deps);
}
```

**Phase 4** (If needed): Introduce lightweight DI container (tsyringe or similar) if constructor injection becomes unwieldy.

---


## Part 8: API Improvement Plan

### 8.1 New Routes Required

| Route | Method | Purpose | Priority |
|-------|--------|---------|----------|
| `/api/auth/signup` | POST | User registration (if not using Supabase client-side) | Critical |
| `/api/wallets/[id]` | DELETE | Wallet removal with escrow check | High |
| `/api/cron/transitions` | POST | Auto-close expired registrations | High |
| `/api/cron/process-events` | POST | Domain event outbox processor | High |
| `/api/cron/reconcile` | POST | Escrow balance reconciliation | High |
| `/api/cron/dispute-deadline` | POST | Auto-dismiss expired disputes | Medium |
| `/api/cron/cleanup` | POST | Idempotency key + old event cleanup | Medium |
| `/api/admin/users` | GET/PATCH | User list + suspend/unsuspend | Medium |
| `/api/admin/events` | GET/PATCH | Event moderation | Medium |
| `/api/admin/audit` | GET | Audit log viewer | Medium |
| `/api/events/[id]/export` | GET | Export event data (CSV/JSON) | Low |
| `/api/workspaces` | POST | Workspace creation | High |
| `/api/workspaces/[id]` | PATCH/DELETE | Workspace management | Medium |
| `/api/health` | GET | Basic health check | High |
| `/api/health/ready` | GET | Readiness (DB + Stellar connectivity) | High |

### 8.2 Route Handler Standardization

All routes should use the `apiHandler` pattern consistently:

```typescript
export const POST = apiHandler({
  requireAuth: true,
  schema: { body: CreateEventSchema },
  rateLimit: 'events.create',
  handler: async ({ body, user, supabase }) => {
    await authorize(user, 'Events', 'create', { workspaceId: body.workspace_id });
    // ... business logic
  }
});
```

**Missing from current `apiHandler`**:
- Rate limit tier specification (add `rateLimit` param)
- Authorization call (currently manual in handler)
- Request size validation (add to middleware)

### 8.3 Cron Endpoint Security

All `/api/cron/*` routes must verify a secret header:

```typescript
function verifyCronSecret(request: Request): void {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    throw new ForbiddenError('Invalid cron secret');
  }
}
```

### 8.4 API Response Consistency

All endpoints already use the `handleApiError` envelope. Additions:
- Pagination metadata in list responses: `{ data, meta: { total, page, pageSize, hasMore } }`
- Rate limit headers on all responses: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Request ID in all responses: `X-Request-Id` (already present ✅)

---

## Part 9: Database Improvement Plan

### 9.1 New Migrations Required

| Migration | Purpose | Priority |
|-----------|---------|----------|
| `000014_disbursement_lock.sql` | Advisory lock RPCs for disbursement mutex | Critical |
| `000015_financial_precision.sql` | `numeric(20,7)` on all amount columns | Critical |
| `000016_domain_events_outbox.sql` | Transactional outbox table + indexes | High |
| `000017_winner_uniqueness.sql` | UNIQUE (event_id, recipient_id) on winners | High |
| `000018_prize_split_policy.sql` | `prize_split_policy` column on events | High |
| `000019_dispute_deadline.sql` | `auto_dismiss_at` column on disputes | Medium |
| `000020_wallet_protection.sql` | RPC to check wallet dependencies | High |
| `000021_judge_quorum.sql` | `min_judges_per_submission` on events | Medium |
| `000022_team_formation_rename.sql` | Rename state value (if safe) | Low |

### 9.2 Precision Migration Detail

```sql
-- 000015_financial_precision.sql
ALTER TABLE escrow_accounts
  ALTER COLUMN expected_balance TYPE numeric(20,7),
  ALTER COLUMN last_reconciled_balance TYPE numeric(20,7);
ALTER TABLE transactions ALTER COLUMN amount TYPE numeric(20,7);
ALTER TABLE winners ALTER COLUMN prize_amount TYPE numeric(20,7);
ALTER TABLE events ALTER COLUMN prize_pool_target TYPE numeric(20,7);
```

**Rollback**: No data loss — widening precision is safe. `_down` migration narrows back (potential rounding — warn).

### 9.3 Index Recommendations

```sql
CREATE INDEX idx_winners_event_pending ON winners(event_id) WHERE disbursement_status = 'pending';
CREATE INDEX idx_disputes_event_unresolved ON disputes(event_id) WHERE state IN ('Open','UnderReview');
CREATE INDEX idx_domain_events_pending ON domain_events(created_at) WHERE status = 'pending';
CREATE INDEX idx_escrow_reconcile ON escrow_accounts(id) WHERE state NOT IN ('Released','Refunded');
```

### 9.4 RPC Functions Required

1. `begin_disbursement(event_id, actor_id)` — acquire advisory lock + state transition
2. `abort_disbursement(event_id)` — rollback state on failure
3. `complete_disbursement(event_id)` — finalize state to Released
4. `rpc_confirm_funding(event_id, escrow_id, tx_hash, amount, wallet, actor_id, network)` — atomic fund recording
5. `rpc_record_disbursement_batch(event_id, escrow_id, payments[], network, actor_id)` — atomic batch recording
6. `rpc_record_refund(event_id, escrow_id, tx_hash, amount, destination, actor_id, network)` — atomic refund recording
7. `check_wallet_dependencies(public_key)` — returns blocking references

---


## Part 10: Smart Contract Improvement Plan

### Phase 1: Documentation & Formalization (Week 1–2)

| Task | Deliverable |
|------|-------------|
| Write ADR: "Horizon as Execution Layer, Soroban as State Tracking" | `docs/adr/001-escrow-architecture.md` |
| Document state mapping table in code | `BACKEND_TO_CONTRACT_STATE_MAP` constant |
| Add `get_event_id()` query method for cross-reference | Contract method |
| Add TTL refresh in `deposit()` and `lock()` | Contract code change |
| Fix `queryEscrowState()` — properly parse ScVal responses | `soroban-escrow.ts` |

### Phase 4: Full Soroban Execution (Week 7)

| Task | Deliverable |
|------|-------------|
| Add `admin_deposit(from, amount)` for sponsor deposits | New contract method |
| Split `disburse()` → `disburse_batch()` + `finalize()` | Refactored contract methods |
| Add `DisbursedTotal` counter for partial tracking | New DataKey |
| Add `cancel()` method (distinct from refund) | New contract method |
| Deploy per-event contract (factory pattern) | Deploy script + backend wiring |
| Add reentrancy guard comments (Soroban model prevents classic reentrancy but document) | Code comments |
| TTL refresh in all write methods | Contract code |
| Full unit test suite (soroban-sdk test framework) | Test files |
| Integration test on Stellar Testnet | CI pipeline step |
| Gas profiling | Performance report |
| Mainnet deployment checklist | Ops document |

### Contract Testing Strategy

| Test Type | Scope | Priority |
|-----------|-------|----------|
| Unit (soroban-sdk) | All methods, state transitions, auth checks | Critical |
| Property-based | Fuzz deposit/disburse amounts, recipient counts | High |
| Integration (Testnet) | Full lifecycle: init → deposit → lock → disburse → finalize | High |
| Gas profiling | Cost per operation at various recipient counts | Medium |
| TTL behavior | Verify contract survives long escrow durations | Medium |
| Failure modes | Insufficient balance, unauthorized caller, double-init | High |

### Security Audit Requirements (Before Mainnet)

- [ ] Professional smart contract security audit (external firm)
- [ ] Integer overflow analysis (i128 should be safe for XLM, document)
- [ ] Authorization bypass testing
- [ ] State manipulation testing (can caller force invalid state?)
- [ ] Token contract interaction review (malicious token defense)
- [ ] Re-entrancy analysis (Soroban model + documentation)

---

## Part 11: Security Hardening Plan

### 11.1 Phase 1 — Immediate (Week 1–2)

| Action | Effort | Priority |
|--------|--------|----------|
| Add Upstash Redis rate limiting in middleware | 6h | Critical |
| Add request body size limit (1MB) in middleware | 1h | Critical |
| Secure cron endpoints with `CRON_SECRET` header | 2h | Critical |
| Add Content-Length header validation | 1h | High |
| Remove hardcoded dev encryption key fallback message (make it error clearly) | 1h | High |

### 11.2 Phase 2 — Authorization (Week 3–4)

| Action | Effort | Priority |
|--------|--------|----------|
| Complete PermissionEngine (all 10 roles × 12 resources) | 8h | Critical |
| Migrate all routes to `authorize()` | 12h | Critical |
| Deprecate + remove legacy auth helpers | 2h | High |
| Add disbursement advisory lock (C1) | 4h | Critical |
| Add wallet removal protection API | 3h | High |
| Restrict Module 8 RLS `USING (true)` policies | 2h | Medium |

### 11.3 Phase 3 — Authentication Hardening (Week 5–6)

| Action | Effort | Priority |
|--------|--------|----------|
| MFA enrollment UI (Settings page) | 8h | Critical |
| MFA enforcement middleware (AAL2 for mainnet financial ops) | 4h | Critical |
| CAPTCHA on login/signup (Cloudflare Turnstile) | 4h | High |
| Session management UI (view/revoke) | 6h | Medium |
| Account deletion flow (GDPR) | 4h | Medium |
| Comprehensive RLS policy audit | 4h | High |
| Remove legacy XOR decryption support | 1h | Medium |

### 11.4 Security Testing Checklist

| Test | Method | Priority |
|------|--------|----------|
| OWASP Top 10 verification | Manual checklist | Critical |
| Auth flow pen test (credential stuffing, session fixation) | Automated + manual | Critical |
| SQL injection (verify RPC params are safe) | Automated scan | High |
| XSS (verify CSP + React escaping) | Automated scan | High |
| CSRF (SameSite cookies + CSP form-action) | Manual | Medium |
| Stellar tx replay (verify tx_hash uniqueness) | Integration test | High |
| Advisory lock exhaustion | Load test | Medium |
| Rate limit bypass (IP rotation, user switching) | Manual | Medium |
| File upload validation (MIME spoofing, path traversal) | Manual | High |
| Cross-workspace data leakage | Integration test | High |

---


## Part 12: Scalability & Performance Plan

### 12.1 Current Bottlenecks

| Area | Issue | Impact | Fix |
|------|-------|--------|-----|
| Disbursement | Synchronous batch processing in request handler | Request timeout risk for large events | Queue-based processing (Phase 5) |
| Discover page | Service-role client bypasses RLS for performance | Security trade-off (acceptable) | Document decision |
| Reconciliation | On-demand only (no scheduled) | Drift undetected between transitions | Cron every 30 min |
| Domain events | Inline processing | Request latency increased | Outbox + async processor |
| DB connections | Supabase serverless connection overhead | Cold start latency | Supabase Pooler (PgBouncer) |

### 12.2 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard page load (p95) | < 500ms | Lighthouse / k6 |
| Discover page (100 concurrent) | < 1000ms p95 | k6 |
| API response (general) | < 200ms p50 | Sentry performance |
| Disbursement (async) | < 5 min for 100 winners | Background job timer |
| First Contentful Paint | < 1.5s | Lighthouse |
| Bundle size (first load, gzipped) | < 200KB | `next build` output |
| Database query time | < 50ms p95 | Supabase dashboard |

### 12.3 Optimization Tasks (Phase 5)

| Task | Effort | Impact |
|------|--------|--------|
| Queue-based disbursement (BullMQ or Supabase Edge Function) | 8h | High — removes timeout risk |
| Response caching for public endpoints (stale-while-revalidate) | 4h | Medium |
| N+1 query audit (all list endpoints) | 4h | Medium |
| Supabase connection pooler configuration | 2h | Medium |
| Image optimization (next/image for all assets) | 2h | Low |
| Bundle analysis + route-level code splitting | 4h | Medium |
| Load test with k6 (100 concurrent users) | 8h | High (validation) |
| Monitoring setup (Sentry + custom financial metrics) | 6h | High |
| Vercel deployment optimization (edge runtime where possible) | 4h | Low |

### 12.4 Caching Strategy

| Resource | Strategy | TTL | Invalidation |
|----------|----------|-----|--------------|
| Public event list | stale-while-revalidate | 60s | On event state change |
| Event detail (public) | stale-while-revalidate | 30s | On any event update |
| User profile | no-cache (personalized) | — | — |
| Escrow balance | no-cache (real-time) | — | — |
| Static pages (terms, privacy) | Immutable | 24h | On deploy |

---

## Part 13: Testing & Validation Strategy

### 13.1 Coverage Targets

| Layer | Current | Target | Timeline |
|-------|---------|--------|----------|
| Financial services | ~10% | 90% | Phase 1–2 |
| State machines | ~30% | 95% | Phase 1 |
| Permission engine | 0% | 90% | Phase 2 |
| API routes | ~15% | 80% | Phase 2–3 |
| KMS / Crypto | 0% | 85% | Phase 1 |
| Idempotency | 0% | 85% | Phase 2 |
| UI components | ~5% | 50% | Phase 6 |
| E2E flows | ~0% | Key 10 flows | Phase 7 |
| Contract (Soroban) | 0% | 80% | Phase 4 |

### 13.2 Critical Test Cases

**Financial Flow (20 tests)**:
1. Happy path: fund → lock → disburse → Released
2. Concurrent disbursement → only 1 succeeds (mutex test)
3. Partial batch failure → successful batches recorded, failed held
4. KMS unavailable during disbursement → clean abort
5. Stellar Horizon timeout → retry with backoff
6. Refund after partial disbursement → correct remaining calculation
7. Disbursement with held winners → skipped correctly
8. Prize allocation exceeding balance → validation error
9. Stellar reserve check → prevents overdraft
10. Duplicate funding (same tx_hash) → 409 Conflict
11. Funding precision (7 decimal places) → stored correctly
12. Fee deduction in balance calculation → correct math
13. Team equal_split → correct per-member amounts
14. Team captain_receives → single payment to captain
15. Refund retry exhaustion → state → Failed + notification
16. Concurrent funding verification → idempotent recording
17. Escrow state rollback on abort_disbursement → previous state restored
18. Disbursement on testnet without MFA → succeeds
19. Disbursement on mainnet without MFA → 403 Forbidden
20. Zero-amount winner → skipped (validation prevents)

**Permission (15 tests)**:
21. Each role can perform allowed actions
22. Each role is blocked from disallowed actions
23. Judge sees only assigned submissions (ABAC)
24. Organizer can only edit in editable states (ABAC)
25. Participant can only dispute during DisputeWindow (ABAC)
26. Cross-event isolation → user in Event A cannot access Event B
27. Cross-workspace isolation → Workspace A organizer cannot modify Workspace B
28. Platform Admin overrides all restrictions
29. Suspended user cannot access any resource
30. Unauthenticated user → 401 on protected endpoints
31. Rate-limited user → 429 with Retry-After
32. MFA-required endpoint without AAL2 → 403
33. Cron endpoint without secret → 403
34. Wallet challenge brute-force → rate limited
35. Body size > 1MB → 413 Payload Too Large

**State Machine (10 tests)**:
36. Every valid event transition with met preconditions → success
37. Every invalid transition → error with valid alternatives
38. Concurrent state transition → optimistic lock rejects one
39. Full lifecycle traversal: Draft → ... → Completed
40. Cancellation from every cancellable state
41. Escrow state machine: all 9 states reachable
42. Dispute lifecycle: Open → UnderReview → Upheld/Dismissed/Withdrawn
43. Team formation window respect
44. Submission window respect
45. Registration deadline auto-transition

**E2E (10 flows)**:
46. Full organizer flow: register → workspace → event → fund → publish → complete
47. Full participant flow: register → browse → join → team → submit
48. Judge flow: accept invite → evaluate → submit scores
49. Sponsor flow: accept invite → fund escrow → verify
50. Admin flow: login → dashboard → suspend user → view audit
51. Dispute flow: file → evidence → resolution
52. Wallet connection + verification
53. MFA enrollment + financial operation
54. Dark mode toggle persistence
55. Mobile responsive navigation

### 13.3 Test Infrastructure

| Tool | Purpose | Status |
|------|---------|--------|
| Vitest 4 | Unit + integration | ✅ Configured |
| fast-check 4 | Property-based | ✅ Configured |
| Playwright 1.61 | E2E browser tests | ✅ Configured |
| @axe-core/playwright | Accessibility | ⚠️ Installed, not wired |
| @vitest/coverage-v8 | Coverage reporting | ✅ Configured |
| k6 | Load testing | Need to add |
| soroban-sdk tests | Contract testing | Need to add |

---


## Part 14: Implementation Roadmap

### Phase 1: Critical Blockers (Weeks 1–2)

**Objective**: Eliminate financial vulnerabilities and unblock user onboarding.

| # | Task | Effort | Depends On | Owner |
|---|------|--------|------------|-------|
| 1.1 | Create disbursement advisory lock RPC + migration | 4h | — | Backend |
| 1.2 | Integrate lock into DisbursementService | 4h | 1.1 | Backend |
| 1.3 | Add Upstash Redis rate limiting | 6h | — | Backend |
| 1.4 | Create signup page (`/signup`) | 6h | — | Frontend |
| 1.5 | Create shared auth layout | 2h | — | Frontend |
| 1.6 | Fix login page dark mode (CSS variables) | 2h | — | Frontend |
| 1.7 | Create workspace creation page | 4h | — | Frontend |
| 1.8 | Create terms + privacy pages | 3h | — | Frontend |
| 1.9 | Secure cron endpoints (CRON_SECRET header) | 2h | — | Backend |
| 1.10 | Add request body size limit in middleware | 1h | — | Backend |
| 1.11 | Financial precision migration (numeric 20,7) | 2h | — | Backend |
| 1.12 | Winner uniqueness constraint migration | 1h | — | Backend |
| 1.13 | Write ADR: Soroban/Horizon architecture | 2h | — | Architect |
| 1.14 | Add disbursement retry logic | 4h | 1.2 | Backend |
| 1.15 | Add Stellar reserve validation | 2h | — | Backend |
| 1.16 | Fix `queryEscrowState()` ScVal parsing | 3h | — | Backend |

**Dependencies**: Upstash Redis account provisioned before 1.3.

**Risks**: Rate limiting false positives (mitigation: high limits in dev). Migration safe (additive changes only).

**Success Criteria**:
- [ ] Concurrent disbursement test passes (100 parallel, only 1 succeeds)
- [ ] Signup → confirm → login → dashboard works end-to-end
- [ ] Rate limit returns 429 after threshold
- [ ] All financial columns use numeric(20,7)
- [ ] `queryEscrowState()` returns real values from contract

---

### Phase 2: Core Workflow Completion (Weeks 3–4)

**Objective**: Complete all user journeys, permission system, and data integrity.

| # | Task | Effort | Depends On | Owner |
|---|------|--------|------------|-------|
| 2.1 | Complete PermissionEngine (all 10 roles) | 8h | — | Backend |
| 2.2 | Migrate all routes to `authorize()` | 12h | 2.1 | Backend |
| 2.3 | Database transaction RPCs (funding, disbursement, refund) | 8h | — | Backend |
| 2.4 | Refactor services to use RPCs | 6h | 2.3 | Backend |
| 2.5 | Registration deadline cron job | 4h | — | Backend |
| 2.6 | Wallet removal protection API | 3h | — | Backend |
| 2.7 | Prize split policy (schema + service + wizard UI) | 8h | — | Full-stack |
| 2.8 | Domain event outbox table + processor cron | 8h | — | Backend |
| 2.9 | Dispute deadline auto-dismiss | 3h | — | Backend |
| 2.10 | Team captain transfer API + UI | 4h | — | Full-stack |
| 2.11 | Admin dashboard (users + events + audit) | 12h | 2.1 | Frontend |
| 2.12 | Notification center page (`/notifications`) | 4h | — | Frontend |
| 2.13 | Reconciliation cron (every 30 min) | 4h | — | Backend |
| 2.14 | Idempotency key cleanup cron | 2h | — | Backend |
| 2.15 | Fee accounting in balance calculations | 3h | — | Backend |

**Success Criteria**:
- [ ] Permission matrix: 10 roles × 12 resources verified in tests
- [ ] Funding confirmation atomic (all-or-nothing)
- [ ] Registration auto-closes on deadline
- [ ] Admin can view users, suspend, view audit
- [ ] Reconciliation runs on schedule and alerts on divergence

---

### Phase 3: Security Hardening (Weeks 5–6)

**Objective**: Production-grade security posture.

| # | Task | Effort | Depends On | Owner |
|---|------|--------|------------|-------|
| 3.1 | MFA enrollment UI in settings | 8h | — | Frontend |
| 3.2 | MFA enforcement middleware (mainnet financial ops) | 4h | 3.1 | Backend |
| 3.3 | CAPTCHA on login/signup (Cloudflare Turnstile) | 4h | — | Full-stack |
| 3.4 | Session management UI (view/revoke) | 6h | — | Frontend |
| 3.5 | Account deletion flow (soft-delete + 30-day purge) | 4h | — | Full-stack |
| 3.6 | RLS policy comprehensive audit | 4h | — | Backend |
| 3.7 | Remove legacy auth helpers (deprecated) | 2h | Phase 2 | Backend |
| 3.8 | OWASP Top 10 verification pass | 8h | — | Security |
| 3.9 | Penetration test (auth flow focus) | 8h | 3.3 | Security |
| 3.10 | Input validation audit (all Zod schemas) | 4h | — | Backend |
| 3.11 | Remove legacy XOR decryption code path | 1h | — | Backend |

**Success Criteria**:
- [ ] Mainnet disburse rejects non-MFA session
- [ ] CAPTCHA blocks automated signup
- [ ] Session revocation immediately invalidates token
- [ ] Account deletion removes PII within 30 days
- [ ] Zero critical findings in pen test

---

### Phase 4: Blockchain Optimization (Week 7)

**Objective**: Resolve Soroban contract issues, prepare for mainnet.

| # | Task | Effort | Depends On | Owner |
|---|------|--------|------------|-------|
| 4.1 | Contract: Add `admin_deposit` method | 4h | — | Rust |
| 4.2 | Contract: Split disburse → batch + finalize | 6h | — | Rust |
| 4.3 | Contract: Add TTL refresh in all write methods | 2h | — | Rust |
| 4.4 | Contract: Add DisbursedTotal tracking | 2h | 4.2 | Rust |
| 4.5 | Contract: Full unit test suite | 8h | 4.1-4.4 | Rust |
| 4.6 | Backend: State sync service (contract ↔ DB) | 6h | 4.1-4.4 | Backend |
| 4.7 | Backend: Reconciliation queries contract state | 4h | 4.6 | Backend |
| 4.8 | Testnet deployment + integration testing | 4h | 4.5 | DevOps |
| 4.9 | Gas usage profiling + optimization | 4h | 4.8 | Rust |
| 4.10 | Mainnet deployment checklist document | 2h | All | Architect |

**Success Criteria**:
- [ ] 200-winner disbursement completes (2 batches via contract)
- [ ] Sponsor deposit via contract works end-to-end
- [ ] State sync detects and reports divergence
- [ ] Gas cost per batch < 100,000 stroops

---

### Phase 5: Performance & Scalability (Week 8)

**Objective**: Optimize for production load, add monitoring.

| # | Task | Effort | Depends On | Owner |
|---|------|--------|------------|-------|
| 5.1 | Queue-based disbursement (async background job) | 8h | Phase 1 | Backend |
| 5.2 | Response caching for public endpoints | 4h | — | Backend |
| 5.3 | N+1 query audit + optimization | 4h | — | Backend |
| 5.4 | Supabase connection pooler (PgBouncer) | 2h | — | DevOps |
| 5.5 | Image/asset optimization (next/image) | 2h | — | Frontend |
| 5.6 | Bundle analysis + code splitting | 4h | — | Frontend |
| 5.7 | Load testing with k6 (100 concurrent users) | 8h | — | QA |
| 5.8 | Sentry setup + custom financial metrics | 6h | — | DevOps |
| 5.9 | Vercel deployment configuration | 4h | — | DevOps |
| 5.10 | Environment variables audit (production secrets) | 2h | — | Security |

**Success Criteria**:
- [ ] p95 < 500ms for dashboard
- [ ] 100 concurrent users on discover without degradation
- [ ] Disbursement processes asynchronously (no HTTP timeout)
- [ ] Sentry captures all unhandled errors
- [ ] Bundle < 200KB first load (gzipped)

---

### Phase 6: UX Refinement (Week 9)

**Objective**: Polish all interfaces to production quality.

| # | Task | Effort | Depends On | Owner |
|---|------|--------|------------|-------|
| 6.1 | Breadcrumb navigation on event sub-pages | 4h | — | Frontend |
| 6.2 | OAuth login (Google + GitHub via Supabase) | 6h | — | Full-stack |
| 6.3 | Event template/duplication system | 6h | — | Full-stack |
| 6.4 | Progress indicators (funding %, eval completion) | 4h | — | Frontend |
| 6.5 | Email notification templates (Resend) | 8h | — | Backend |
| 6.6 | Escrow flow diagram on landing page | 4h | — | Frontend |
| 6.7 | Organizer onboarding checklist (dashboard) | 4h | — | Frontend |
| 6.8 | Mobile navigation refinement (SVG icons) | 4h | — | Frontend |
| 6.9 | Accessibility audit (axe-core in Playwright) | 4h | — | QA |
| 6.10 | Empty state illustrations/improvements | 4h | — | Frontend |
| 6.11 | Sponsor dashboard view | 4h | — | Frontend |
| 6.12 | Mentor team viewer | 4h | — | Frontend |

**Success Criteria**:
- [ ] Every page has loading, empty, and error states
- [ ] Mobile nav usable one-handed
- [ ] axe-core: zero critical violations
- [ ] OAuth login works (Google + GitHub)
- [ ] Emails sent for: state changes, dispute filed, prize paid

---

### Phase 7: Production Readiness (Week 10)

**Objective**: Final verification, documentation, launch preparation.

| # | Task | Effort | Depends On | Owner |
|---|------|--------|------------|-------|
| 7.1 | Full E2E test suite (10 critical flows in Playwright) | 12h | All phases | QA |
| 7.2 | Financial flow integration tests (Stellar Testnet) | 8h | Phase 4 | Backend |
| 7.3 | Security review of all changes | 4h | All phases | Security |
| 7.4 | Production environment setup (secrets, DNS, CDN) | 4h | — | DevOps |
| 7.5 | Backup + disaster recovery plan + test | 4h | — | DevOps |
| 7.6 | Operational runbook | 4h | — | DevOps |
| 7.7 | API documentation (OpenAPI spec) | 8h | — | Backend |
| 7.8 | User documentation (help center content) | 6h | — | Product |
| 7.9 | Load test at production scale | 4h | 5.7 | QA |
| 7.10 | Final re-audit + go/no-go decision | 4h | All | Team |

**Success Criteria**:
- [ ] All E2E tests pass on production-like environment
- [ ] Financial flow tested with real testnet XLM
- [ ] Disaster recovery tested (DB restore, secret rotation)
- [ ] API documentation covers all endpoints
- [ ] Re-audit score ≥ 85/100

---


## Part 15: Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Contingency |
|---|------|-----------|--------|------------|-------------|
| R1 | Upstash Redis downtime blocks all auth | Low | High | In-memory LRU fallback with alert | Temporarily disable rate limiting via env flag |
| R2 | Migration breaks existing escrow data | Medium | Critical | Run on staging first; precision widening is non-destructive | Rollback migration script ready |
| R3 | Advisory lock held indefinitely (process crash) | Low | Medium | PostgreSQL auto-releases on session disconnect | Manual lock release via `pg_advisory_unlock_all()` |
| R4 | MFA enrollment confuses non-technical users | Medium | Low | Clear onboarding guide; only required for mainnet | Support documentation + help link in modal |
| R5 | Soroban contract upgrade breaks existing escrows | Low | Critical | Deploy new contract per event; never upgrade existing instances | Manual state reconciliation procedure |
| R6 | Rate limiting blocks legitimate heavy usage | Medium | Medium | Per-user limits (not IP-only); configurable thresholds | Allow-list for known heavy users |
| R7 | Domain event outbox grows unbounded | Low | Low | Processed events purged after 7 days (cleanup cron) | Manual truncation procedure |
| R8 | Concurrent migration by two developers | Low | Medium | Numbered migration convention; PR review gate | Manual conflict resolution |
| R9 | KMS key rotation breaks encrypted secrets | Low | Critical | Re-encryption script exists (`migrate-escrow-keys.ts`) | Document rotation procedure in runbook |
| R10 | Stellar network congestion delays disbursement | Medium | Medium | Retry logic + user notification + async queue | Manual retry from admin panel |
| R11 | Supabase outage during financial operation | Low | High | Transaction boundaries ensure atomicity; retry on reconnect | Manual reconciliation procedure |
| R12 | Third-party dependency vulnerability | Medium | Medium | Dependabot/Renovate for automated alerts; pinned versions | Patch within 48h SLA |
| R13 | Team member leaves mid-implementation | Low | High | All tasks documented in blueprint; knowledge in code | Any team member can pick up any phase |
| R14 | Load test reveals fundamental architecture issue | Low | High | Early Phase 5 load test gives time to pivot | Architecture rework in extended Phase 5 |
| R15 | Smart contract security audit finds critical issue | Medium | Critical | Defer mainnet until audit passes; testnet continues | Contract redesign if needed |

---

## Part 16: Production Readiness Checklist

### Security ✓
- [ ] Rate limiting active on all endpoints (tiered)
- [ ] MFA enforced for mainnet financial operations
- [ ] CAPTCHA on authentication forms
- [ ] All endpoints use `authorize()` via PermissionEngine
- [ ] No secrets in codebase (verified via git-secrets scan)
- [ ] CSP headers strict in production (nonce-based)
- [ ] HSTS preload active
- [ ] All dependencies pinned and `npm audit` clean
- [ ] Cron endpoints authenticated with CRON_SECRET
- [ ] Request body size limited (1MB)
- [ ] Legacy XOR decryption removed
- [ ] Module 8 RLS policies restricted

### Financial Integrity ✓
- [ ] Disbursement mutex prevents double-spend (advisory lock)
- [ ] Database transactions wrap all financial operations (RPCs)
- [ ] Stellar reserve calculated before disbursement
- [ ] Amount precision: `numeric(20,7)` throughout
- [ ] Fee accounting in balance calculations
- [ ] Reconciliation cron running every 30 min
- [ ] Reconciliation alerts on divergence immediately
- [ ] Refund retry logic (3 attempts, exponential backoff)
- [ ] Disbursement retry logic (3 attempts, exponential backoff)
- [ ] Prize split policy enforced for team events
- [ ] Winner uniqueness constraint (no duplicate allocations)
- [ ] Audit trail immutable and complete (outbox pattern)
- [ ] Idempotency keys enforced on financial endpoints

### Blockchain ✓
- [ ] ADR documents Horizon (execution) + Soroban (tracking) architecture
- [ ] State mapping table (backend ↔ contract) in code
- [ ] Reconciliation queries both Horizon balance and contract state
- [ ] Mainnet gated behind `STELLAR_MAINNET_ENABLED` flag
- [ ] Transaction fees accounted in balance calculations
- [ ] All on-chain transactions linkable via tx_hash to Stellar Expert
- [ ] `queryEscrowState()` returns real values (ScVal parsed)
- [ ] Contract TTL refreshed in write operations
- [ ] Per-event contract deployment (Phase 4+)

### User Experience ✓
- [ ] All user roles can complete their full journey (validated)
- [ ] No dead-end pages or broken links
- [ ] Loading, empty, and error states on every page
- [ ] Mobile-responsive across all pages
- [ ] Accessibility: zero critical axe-core violations
- [ ] Dark mode works on every page (no hardcoded colors)
- [ ] Breadcrumb navigation on event sub-pages
- [ ] Signup page functional
- [ ] Workspace creation functional
- [ ] Admin dashboard functional
- [ ] Terms/Privacy pages exist and linked

### Infrastructure ✓
- [ ] Environment variables documented in `.env.example`
- [ ] Secrets rotatable without code deploy
- [ ] Health checks: `/api/health` (basic) + `/api/health/ready` (deep)
- [ ] Error tracking (Sentry) configured and alerting
- [ ] Database backups scheduled (Supabase automated)
- [ ] Deployment pipeline automated (Vercel or equivalent)
- [ ] Monitoring dashboards: response times, error rates, financial ops
- [ ] Upstash Redis provisioned and connected
- [ ] Cron jobs scheduled (Vercel Cron or equivalent)
- [ ] DNS + SSL configured for production domain

### Testing ✓
- [ ] Unit test coverage > 60% overall
- [ ] Financial service coverage > 90%
- [ ] State machine coverage > 95%
- [ ] Permission engine coverage > 90%
- [ ] Integration tests for all critical API endpoints
- [ ] E2E tests for 10 critical user flows
- [ ] Load test passes at 100 concurrent users
- [ ] Financial flow tested on Stellar Testnet with real transactions
- [ ] Accessibility tests passing (axe-core in Playwright)
- [ ] No flaky tests (all pass reliably in CI)

---


## Part 17: Documentation Updates Required

| Document | Action | Priority | Owner |
|----------|--------|----------|-------|
| `docs/adr/001-escrow-architecture.md` | CREATE — Horizon vs Soroban decision | Critical | Architect |
| `docs/adr/002-rate-limiting.md` | CREATE — Upstash Redis strategy | High | Backend |
| `docs/adr/003-outbox-pattern.md` | CREATE — Domain event reliability | High | Backend |
| `docs/adr/004-permission-model.md` | CREATE — RBAC + ABAC consolidation | High | Backend |
| `SECURITY.md` | CREATE — Responsible disclosure policy | High | Security |
| `docs/API.md` (or OpenAPI spec) | CREATE — All public endpoints | Medium | Backend |
| `docs/DEPLOYMENT.md` | CREATE — Production setup guide | High | DevOps |
| `docs/RUNBOOK.md` | CREATE — Operational procedures | High | DevOps |
| `docs/MAINNET_CHECKLIST.md` | CREATE — Pre-mainnet verification steps | Critical | All |
| `.env.example` | UPDATE — Add Upstash, Turnstile, CRON_SECRET vars | High | Backend |
| `README.md` | UPDATE — Architecture diagram, getting started | Medium | All |
| `CONTRIBUTING.md` | UPDATE — Mention new auth pattern, permission system | Low | Backend |
| `web/package.json` | UPDATE — New dependencies (upstash, turnstile) | High | Backend |
| State machine docs (inline) | UPDATE — Clarify TeamFormationLocked naming | Low | Backend |

---

## Part 18: Final Go/No-Go Assessment

### Go Criteria (ALL must be true)

1. **Zero Critical Issues Open**: C1–C8 all resolved and verified
2. **Financial Safety Proven**: Double-spend test passes under load; reserve checks prevent overdraft; precision correct
3. **Security Baseline Met**: Rate limiting + MFA + CAPTCHA all active and tested
4. **User Journeys Complete**: Every role completes primary flow without encountering missing page or dead end
5. **Test Coverage Threshold**: > 60% overall, > 90% financial services, > 95% state machines
6. **Monitoring Active**: Sentry configured, financial alerts active, reconciliation divergence alerts working
7. **Documentation Complete**: API docs, deployment guide, runbook, ADRs all written
8. **Re-Audit Score**: ≥ 85/100 on repeat of FULL_PRODUCTION_AUDIT methodology
9. **Load Test Passes**: 100 concurrent users, p95 < 1s, no errors
10. **Blockchain Verified**: Financial flow tested on Stellar Testnet with real transactions, all tx confirmed

### No-Go Triggers (ANY blocks launch)

- Any unresolved Critical (C-tier) issue
- Financial test showing possible double-spend
- Security pen test with unresolved critical finding
- Smart contract audit with critical vulnerability (blocks mainnet only)
- E2E test failure on a primary user journey
- Reconciliation showing persistent state divergence

### Post-Launch Monitoring Plan (First 2 Weeks)

| Metric | Alert Threshold | Response |
|--------|----------------|----------|
| Error rate (5xx) | > 1% of requests | Investigate immediately |
| Disbursement failure | Any single failure | Manual review within 1h |
| Reconciliation divergence | Any mismatch | Pause automated disbursements, investigate |
| Response time (p95) | > 2s sustained | Scale review |
| Rate limit exhaustion | > 10 unique IPs hitting limit/min | Potential attack, review |
| MFA enrollment rate | < 50% of financial users | UX improvement needed |
| Escrow balance drift | > 0.0000001 XLM | Investigate fee accounting |

---

## Appendix A: Dependency Additions

```json
{
  "dependencies": {
    "@upstash/ratelimit": "^2.0.0",
    "@upstash/redis": "^1.34.0"
  },
  "devDependencies": {
    "@cloudflare/turnstile": "^0.2.0"
  }
}
```

## Appendix B: New Environment Variables

```bash
# Rate Limiting (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# CAPTCHA (Cloudflare Turnstile)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Cron Authentication
CRON_SECRET=

# MFA (handled by Supabase Auth — no additional vars)
# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

## Appendix C: Effort Summary

| Phase | Duration | Story Points | Team |
|-------|----------|--------------|------|
| Phase 1: Critical Blockers | 2 weeks | 46 SP | 2 devs |
| Phase 2: Workflow Completion | 2 weeks | 68 SP | 2 devs |
| Phase 3: Security Hardening | 2 weeks | 53 SP | 2 devs |
| Phase 4: Blockchain | 1 week | 42 SP | 1 Rust + 1 TS |
| Phase 5: Performance | 1 week | 44 SP | 2 devs |
| Phase 6: UX Refinement | 1 week | 52 SP | 1 dev + 1 designer |
| Phase 7: Production Readiness | 1 week | 54 SP | 2 devs |
| **Total** | **10 weeks** | **359 SP** | **2–3 devs average** |

## Appendix D: Updated Business Rules

| Rule | Current State | Required State |
|------|--------------|----------------|
| Disbursement exclusivity | ❌ No mutex | ✅ Advisory lock per event |
| Winner uniqueness | ❌ No constraint | ✅ UNIQUE (event_id, recipient_id) |
| Financial precision | ⚠️ Unspecified numeric | ✅ numeric(20,7) |
| Stellar reserve | ❌ Not checked | ✅ 1 XLM + fees retained |
| Prize splitting | ❌ Single recipient | ✅ Policy-driven (captain/equal/custom) |
| Dispute deadline | ❌ Indefinite | ✅ Auto-dismiss after 14 days |
| Registration deadline | ❌ Manual only | ✅ Auto-transition via cron |
| Wallet removal | ❌ No check | ✅ Blocked if active escrow reference |
| Funding deadline | ❌ None | ✅ Configurable, event cannot publish without funded escrow or explicit waiver |
| Judge quorum | ❌ Not enforced | ✅ Minimum judges per submission (configurable) |
| Team name uniqueness | ❌ Not enforced | ✅ UNIQUE (event_id, name) within event |

---

*End of Comprehensive Remediation Blueprint v2*

**Current Assessment**: NOT PRODUCTION READY (52/100)  
**Target**: 85+/100 after Phase 7 completion  
**Estimated Timeline**: 10 weeks with 2–3 engineers  
**Next Action**: Begin Phase 1 immediately — start with C1 (disbursement lock) and C3 (signup page) in parallel.
