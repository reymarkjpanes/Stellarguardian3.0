# Stellar Guardian 3.0 — Full End-to-End Production Readiness Audit

**Audit Date**: July 21, 2026
**Auditors**: Principal Architect · Senior PM · UX Designer · Staff Engineer · Security Engineer · Blockchain Engineer · QA Lead
**Version Audited**: 0.1.0 (web/)
**Previous Audit**: July 20, 2026 (Score: 42/100)

---

## Executive Summary

Stellar Guardian 3.0 is a Next.js 15+ / Supabase / Stellar blockchain platform for hosting hackathons with on-chain escrow-backed prize distribution. Since the previous audit (July 20), **two critical fixes have been applied**:

1. ✅ **KMS encryption now used** in `FundingService.createEscrowAccount()` — `encryptSecret()` properly called
2. ✅ **Transaction signing implemented** in `DisbursementService` and `RefundService` — escrow keypair decrypted and used to sign XDR before submission

**However, significant issues remain that block production deployment.** The platform has moved from "Late Alpha" to "Early Beta" — core financial flows are now wired end-to-end, but edge cases, missing pages, permission gaps, and insufficient testing prevent production readiness.

**Updated Overall Readiness Score: 52/100** — Early Beta (up from 42).


---

## Updated Scoring Summary

| Dimension | Previous | Current | Status |
|-----------|----------|---------|--------|
| Architecture | 55 | 60 | 🟡 Consistent service layer, DDD migration cleaned up |
| Security | 65 | 70 | 🟡 KMS fix applied, but MFA/rate-limit still missing |
| Financial Workflow | 45 | 65 | 🟡 Signing fixed, retry logic added, but no DB transactions |
| Blockchain | 50 | 58 | 🟡 Soroban contract solid, Horizon adapter complete |
| UX/UI | 40 | 50 | 🟡 Core flows functional, missing pages remain |
| Testing | 35 | 38 | 🔴 Minimal improvement — still critically low |
| Performance | 50 | 52 | 🟡 Parallel data fetching, but no optimization pass |
| **Overall** | **42** | **52** | **🟡 Early Beta** |

---

## Section 1: Product Journey Audit

### 1.1 Visitor Journey

| Step | Implemented | Issues |
|------|-------------|--------|
| Landing page | ✅ | Clean, focused, no AI-slop |
| Discover events | ✅ | Full-text search + cursor pagination |
| View event detail (public) | ✅ | `/e/[id]` route exists |
| Understand how platform works | ✅ | "How it works" section present |
| Register | ⚠️ Partial | `/signup` exists but no actual page found in codebase scan |
| Connect wallet | ✅ | Freighter flow with confirm step |
| Login | ✅ | Email/password |
| Logout | ✅ | Via header dropdown + settings |

**Issues Found**:
- No `/signup` page file detected — may be a redirect to Supabase Auth UI or missing entirely
- Landing page lacks social proof (no logos, testimonials, stats)
- No "how escrow works" explainer with visual diagram — critical for trust
- Footer links to `/terms` and `/privacy` — these pages likely don't exist (no route files found)


### 1.2 Registered User Journey

| Step | Implemented | Issues |
|------|-------------|--------|
| Profile creation | ✅ | Display name editable via `/settings` |
| Wallet connection | ✅ | Freighter adapter with confirm-before-link UX |
| Multiple wallets | ✅ | Can add/remove wallets on settings page |
| Settings page | ✅ | Profile + wallets + send XLM |
| Notifications | ⚠️ Partial | NotificationBell in nav, notification service exists, but no `/notifications` page found |
| KYC | ❌ Missing | No KYC workflow — financial platform needs this for mainnet |

**Issues Found**:
- Settings page has unused `userId` parameter in `ProfileEditForm` — dead code
- `FormEvent` type import is deprecated (TS diagnostic) — should use `React.FormEvent`
- Wallet removal has no check: "Is this wallet assigned as a prize recipient in an active event?"
- No session management UI (view active sessions, revoke devices)
- No account deletion workflow (GDPR compliance gap)

### 1.3 Workspace Creator Journey

| Step | Implemented | Issues |
|------|-------------|--------|
| Create workspace | ⚠️ | QuickAction links to `/workspaces/new` — page likely exists |
| Configure workspace | ⚠️ | Basic CRUD in API, unclear if full config page exists |
| Branding | ❌ | No workspace branding fields in schema |
| Roles/Permissions | ✅ | workspace_members with Owner/Admin/Member roles |
| Invitations | ✅ | Invitation service + API routes exist |
| Workspace security | ⚠️ | Webhook manager exists, no IP allowlisting |

**Issues Found**:
- Workspace creation wizard not found in scanned pages — may be a simple form or missing
- No workspace-level billing or subscription management
- No workspace deletion flow (what happens to events under it?)


### 1.4 Event Organizer Journey

| Step | Implemented | Issues |
|------|-------------|--------|
| Create event (4-step wizard) | ✅ | Well-designed stepper with draft persistence |
| Configure event rules | ⚠️ Partial | Basic config in wizard, no dedicated rules page |
| Timeline/milestones | ✅ | API route exists (`/api/events/[id]/milestones`) |
| Categories/tracks | ⚠️ | Single category per event, no multi-track support |
| Eligibility rules | ❌ | No eligibility criteria configuration |
| Submission rules | ⚠️ | `file_policy` and `resubmission_policy` in DB, unclear if configurable in UI |
| Judging criteria | ✅ | Criteria API route + rubrics table |
| Assign sponsors | ✅ | Sponsors API route exists |
| Assign mentors | ⚠️ | `Mentor` role exists but no mentor-specific assignment UI found |
| Assign judges | ✅ | Event members with Judge role |
| Prize pool configuration | ✅ | In wizard + edit page |
| Publish event | ✅ | State transition Draft → Published |

**Critical Issues**:
1. **Event edit page** (`/events/[id]/edit`) exists — but no validation that only organizers in correct state can access it
2. **No "Preview as Participant" mode** — organizers can't see what public visitors see
3. **Mainnet event creation**: Warning shown, but no additional confirmation gate (e.g., mandatory checkbox "I understand real XLM will be used")
4. **Wizard draft persistence**: Uses `localStorage` — lost if user clears browser data. No server-side draft saving.
5. **Team size validation only client-side in wizard** — server `CreateEventSchema` should also enforce constraints

### 1.5 Funding the Event

| Step | Implemented | Issues |
|------|-------------|--------|
| Sponsor deposits | ✅ | FundingService.verifyFunding() |
| Escrow account creation | ✅ | FundingService.createEscrowAccount() with KMS encryption |
| Deposit confirmation (on-chain) | ✅ | Stellar Horizon tx verification |
| Escrow state visible to public | ✅ | `/api/events/[id]/verify-escrow` is public |
| Can organizers publish unfunded? | ⚠️ Yes | State machine allows Draft → Published without escrow |

**Critical Issues**:
1. **No idempotency on funding verification**: If `verifyFunding` is called twice with the same `txHash`, the `transactions` table has a `UNIQUE(tx_hash)` constraint that will throw — but the error isn't handled gracefully, and no duplicate detection message is returned.
2. **Race condition on balance check**: Between `getBalance()` and `EscrowRepository.fundEscrow()`, another deposit could arrive, making the recorded balance stale.
3. **No funding deadline**: Organizer could publish an event, accept registrations, and never fund it. Participants have no protection.
4. **Reconciliation cron exists** (`/api/cron/reconcile`) but no scheduling infrastructure configured.


### 1.6 Participant Journey

| Step | Implemented | Issues |
|------|-------------|--------|
| Discover event | ✅ | Public discover page with search |
| Register/Apply | ✅ | `/api/events/[id]/register` route |
| Join waitlist | ❌ | No waitlist mechanism found |
| Receive approval notification | ✅ | Notification service fires on status change |
| View event detail (authenticated) | ✅ | Rich event detail with lifecycle stepper |

**Issues**:
- No "withdraw application" UI found
- No indication of registration capacity (max participants per event not in schema)
- Registration deadline auto-transition not implemented (comment in code mentions it, but no cron/trigger)

### 1.7 Team Formation

| Step | Implemented | Issues |
|------|-------------|--------|
| Create team | ✅ | Team service + API |
| Join team (request) | ✅ | JOIN route with pending/accept/reject flow |
| Accept/reject requests | ✅ | Captain can resolve via PATCH |
| Leave team | ⚠️ | Service exists but unclear if UI exposed |
| Remove member | ⚠️ | No explicit endpoint found in scan |
| Transfer captain | ❌ | Not implemented |
| Lock roster | ⚠️ | Enforced by event state (TeamFormationLocked) but no explicit lock action |

**Critical Issues**:
1. **Team join only allowed during `TeamFormationLocked` state** (per route handler) — but the state name is confusing. "TeamFormationLocked" sounds like formation is *locked*, not *open*. This is a naming issue that will confuse both developers and users.
2. **No duplicate team check**: Can the same user create multiple teams? The DB has a `team_members` unique constraint but `teams` table allows multiple teams by same captain.
3. **No team name validation**: No uniqueness constraint on team names within an event.
4. **No captain-leaves protection**: What happens to the team? Code doesn't handle orphaned teams.

### 1.8 Judge Journey

| Step | Implemented | Issues |
|------|-------------|--------|
| Accept invitation | ✅ | Invitation service with accept flow |
| View assigned submissions | ✅ | Evaluations page |
| Score submissions | ✅ | Evaluation API with conflict-of-interest flag |
| Save draft | ⚠️ | Evaluation status supports Draft |
| Submit final score | ✅ | Status → Submitted |
| Conflict of interest | ✅ | `conflict_of_interest` flag in evaluations table |

**Issues**:
- No "assigned submissions" filtering — judges may see ALL submissions without assignment logic
- No quorum enforcement (minimum judges per submission)
- No score editing after submission (may be intentional, but not documented for judges)
- Judge/Participant mutual exclusion enforced at DB level ✅ (partial unique index)


### 1.9 Submission Process

| Step | Implemented | Issues |
|------|-------------|--------|
| Upload project | ✅ | Submissions API + file upload |
| Version history | ✅ | submission_versions table (append-only) |
| Edit before deadline | ✅ | Resubmission policy configurable |
| Edit after deadline | ⚠️ | Depends on policy JSONB — no UI to configure |
| File validation | ✅ | file-validation service with MIME/size checks |

**Issues**:
- No repository integration (GitHub link field exists in schema but no OAuth flow for verification)
- No demo video hosting/embedding — just a URL field
- No plagiarism detection
- No maximum file count limit visible in schema

### 1.10 Winner Selection & Prize Distribution

| Step | Implemented | Issues |
|------|-------------|--------|
| Ranking generation | ✅ | FinalizationActionBox triggers ranking |
| Tie handling | ❌ | No tie-breaking logic found |
| Manual override | ⚠️ | Organizer can assign winners directly |
| Approval workflow | ⚠️ | State machine gate (WinnerVerification → PrizeApproved) |
| Prize allocation validation | ✅ | `validatePrizeAllocation` checks on-chain balance |
| Wallet verification | ✅ | Only verified wallets receive funds |
| Multi-recipient batched payouts | ✅ | MAX_OPS_PER_TX = 100 per batch |
| Team payout splits | ❌ | No split logic — prizes go to `recipient_id` (individual) |
| Held payments (no wallet) | ✅ | Winners without verified wallet get `disbursement_status: "held"` |
| Transaction history | ✅ | `transactions` table + API route |
| On-chain verification | ✅ | Public verify-escrow endpoint |

**Critical Issues**:
1. **No duplicate winner check**: `winners` table has no unique constraint on `(event_id, recipient_id)`. Same person could be allocated prizes twice.
2. **No idempotency on disbursement**: If `executeDisbursement` is called twice, it processes all `pending` winners again. The `tx_hash` unique constraint on `transactions` protects against double-recording, but not against double-submission to Stellar.
3. **No partial failure recovery**: If batch 1 of 3 succeeds but batch 2 fails, the successful payments are recorded but the system state is messy. No rollback mechanism.
4. **Team prize splitting not supported**: Prize goes to a single `recipient_id`. For team events, who gets paid? The captain? All members equally? This is undefined.
5. **No disbursement confirmation dialog** (beyond FinalizationActionBox which finalizes judging, not disbursement itself).

### 1.11 Dispute Handling

| Step | Implemented | Issues |
|------|-------------|--------|
| File dispute | ✅ | Only during DisputeWindow state, only by accepted participants |
| Review evidence | ⚠️ | `dispute_evidence` table exists, unclear if upload UI works |
| Freeze payout | ✅ | `isDisbursementBlocked()` checks for unresolved disputes |
| Resolve dispute | ✅ | State transitions with role-gated access |
| Notify parties | ✅ | Filer notified on resolution |

**Issues**:
- No dispute deadline (disputes could stay "Open" indefinitely, blocking disbursement forever)
- No escalation path if organizer doesn't resolve
- No evidence file upload UI found
- Dispute reason categories not defined (free-text only)


---

## Section 2: UI/UX Audit

### 2.1 Design Consistency

| Aspect | Status | Notes |
|--------|--------|-------|
| Font system | ✅ | System fonts, no Inter default |
| Color system | ✅ | CSS custom properties throughout |
| Spacing system | ✅ | Consistent Tailwind spacing scale |
| Border radius | ✅ | `rounded-md` / `rounded-lg` consistently |
| Dark mode | ✅ | ThemeProvider with localStorage persistence |
| No AI-purple | ✅ | Accent via CSS var, no purple gradients |
| Component consistency | ✅ | `card` class used uniformly |
| Mobile responsiveness | ✅ | Responsive breakpoints in grid layouts |

### 2.2 Accessibility

| Check | Status | Notes |
|-------|--------|-------|
| Skip-to-content link | ✅ | In root layout |
| ARIA labels on interactive elements | ✅ | Nav buttons, dialogs properly labeled |
| Role attributes on dialogs | ✅ | `role="dialog"` with `aria-modal` |
| Focus management in modals | ✅ | Auto-focus input, Escape closes |
| Body scroll lock in modals | ✅ | `overflow: hidden` applied |
| Color contrast | ⚠️ | CSS vars make verification hard without runtime |
| Keyboard navigation | ✅ | Dropdown closes on Escape |
| Form labels | ✅ | All inputs have associated labels |
| Error announcements | ✅ | `role="alert"` on error messages |

### 2.3 Page-by-Page Assessment

| Page | Loading State | Empty State | Error State | Mobile |
|------|--------------|-------------|-------------|--------|
| Landing | N/A (SSR) | N/A | ✅ (try/catch fallthrough) | ✅ |
| Login | ✅ (button text) | N/A | ✅ (alert) | ⚠️ Fixed width |
| Dashboard | ✅ (SSR) | ✅ ("Get started") | ⚠️ No explicit | ✅ |
| Create Event | ✅ (submitting state) | ✅ (no workspace warning) | ✅ (field errors) | ✅ |
| Event Detail | ✅ (SSR) | N/A | ✅ (notFound) | ⚠️ |
| Discover | ✅ (SSR) | ✅ (empty card) | ⚠️ No network error | ✅ |
| Settings | ✅ (spinner) | ✅ (no wallets) | ✅ (alerts) | ✅ |
| Teams | ✅ (SSR) | ⚠️ Depends on client | N/A | ⚠️ |
| Disputes | ✅ (SSR) | ⚠️ Depends on client | N/A | ⚠️ |

### 2.4 Critical UX Issues

1. **Login page uses hardcoded neutral colors** instead of CSS variables — breaks dark mode
2. **No signup page found** — critical gap in onboarding funnel
3. **No workspace creation page found** — users see "Create Workspace" button but may hit 404
4. **Event creation wizard has no "Discard draft" button** — user is stuck with localStorage draft
5. **Discover page uses `createServiceClient`** (service-role) for public reads — bypasses RLS. This is intentional for performance but a security consideration.
6. **Mobile nav uses text characters ("✕", "☰") instead of SVG icons** — inconsistent sizing across devices
7. **Profile dropdown has no outside-click-via-ref handling** — uses a full-screen invisible div overlay (works but is hacky)
8. **No breadcrumb navigation** within event sub-pages (teams, submissions, winners, disputes)


---

## Section 3: Backend Audit

### 3.1 API Design

| Aspect | Status | Notes |
|--------|--------|-------|
| Consistent error envelope | ✅ | `handleApiError` + typed error classes |
| Zod validation | ✅ | Schema-first via `apiHandler` |
| Auth check | ✅ | `requireAuth: true` on protected routes |
| Pagination | ✅ | limit/offset on list endpoints, cursor on discover |
| Rate limiting | ❌ | Removed for development, not re-added |
| CORS | ⚠️ | Relies on same-origin (Next.js); no explicit CORS headers |
| Versioned API | ✅ | `/api/v1/` prefix exists |
| Optimistic concurrency | ✅ | Version field required on PATCH |

### 3.2 Authorization

| Check | Status | Severity |
|-------|--------|----------|
| Middleware auth gate | ✅ | Public/protected path distinction |
| Route-level RBAC | ⚠️ | Some routes use `apiHandler` auth, others manual check |
| PermissionEngine coverage | ⚠️ | Only 3 of 10 roles defined (previous finding still open) |
| RLS on all tables | ✅ | Comprehensive policies |
| Service-role client used correctly | ✅ | Only in server-only services |
| Escrow secret never exposed via API | ✅ | No select on encrypted_secret_key in client queries |

**Remaining Issue**: The dual authorization system (PermissionEngine vs legacy `requireEventRole`) creates confusion. Some routes check role via PermissionEngine, others via direct DB query of `event_members.role`. This needs consolidation.

### 3.3 Data Integrity

| Check | Status | Notes |
|-------|--------|-------|
| Foreign key constraints | ✅ | All relationships properly constrained |
| CHECK constraints | ✅ | State enums, amount ≥ 0, address regex |
| Unique constraints | ✅ | tx_hash, (event_id, user_id, role), etc. |
| Cascading deletes controlled | ✅ | Most use `ON DELETE RESTRICT` (safe) |
| Optimistic locking | ✅ | Version columns on events, escrow |
| Audit trail | ✅ | `audit_records` table + immutability trigger |
| Idempotency keys | ✅ | `idempotency_keys` table with cleanup cron |

### 3.4 Concurrency & Race Conditions

| Scenario | Protection | Status |
|----------|-----------|--------|
| Double funding | tx_hash UNIQUE | ✅ |
| Double disbursement | Checks `disbursement_status: "pending"` | ⚠️ TOCTOU gap |
| Concurrent escrow state change | Version column + optimistic lock | ✅ |
| Simultaneous team joins | DB constraint (one team per participant) | ✅ |
| Concurrent event state transitions | Version check in `optimisticUpdate` | ✅ |

**Critical Gap**: The disbursement flow reads `pending` winners, then processes them. If two requests hit simultaneously, both will read the same pending winners and attempt double payment. The DB `transactions.tx_hash` uniqueness prevents double-recording, but not double-submission to Stellar (which would have different hashes). **This is a double-spend vulnerability.**

**Fix Required**: Add `SELECT ... FOR UPDATE` or an idempotency check (e.g., set `disbursement_status = "processing"` before starting, using a CAS operation).


---

## Section 4: Smart Contract Audit (Soroban)

### 4.1 Contract Analysis

| Method | Security | Issues |
|--------|----------|--------|
| `initialize` | ✅ | One-time only, admin auth required |
| `deposit` | ✅ | Only organizer can deposit, state check |
| `lock` | ✅ | Admin-only, requires FullyFunded |
| `disburse` | ⚠️ | Admin-only, requires Locked — see below |
| `refund` | ✅ | Admin-only, blocks if Released/Refunded |
| `get_balance` | ✅ | Read-only |
| `get_state` | ✅ | Read-only |

### 4.2 Contract Vulnerabilities

1. **🟠 No partial disbursement support**: `disburse()` transitions directly to `Released` state. If the first call disburses to 5 of 10 winners, the state becomes `Released` and no second call can be made for the remaining 5. The backend batches at MAX_OPS_PER_TX=100, but if there are >100 winners, only the first batch can succeed on-chain.

2. **🟠 No reentrancy protection**: While Soroban's execution model largely prevents classic reentrancy, the contract does make external calls (`token_client.transfer`) in a loop within `disburse()`. A malicious token contract could potentially interfere.

3. **🟡 No event_id validation**: The contract stores `event_id` as `Bytes` but never uses it for access control. It's purely informational.

4. **🟡 Integer overflow potential**: `new_balance = current_balance + amount` — while `i128` overflow is practically impossible for XLM amounts, there's no explicit overflow check.

5. **🟡 No TTL refresh in long-lived operations**: `extend_ttl` called only in `initialize`. Long-running escrows could expire if not refreshed.

### 4.3 Backend↔Contract Consistency

| Business Rule | Backend | Contract | Consistent? |
|---------------|---------|----------|-------------|
| States | 9 states (DB) | 6 states (Soroban) | ❌ Mismatch |
| Deposit auth | Any funding wallet | Only organizer | ❌ Mismatch |
| Disburse auth | Platform service key | Platform admin | ✅ |
| Partial funding | PartiallyFunded state | PartiallyFunded state | ✅ |
| Dispute freeze | Checked in backend | Not enforced on-chain | ⚠️ Relies on backend |

**Critical Mismatch**: Backend allows any `funding_wallet` to fund the escrow (sponsor use case). The Soroban contract only allows the `organizer` address to `deposit`. This means the contract cannot support third-party sponsor deposits as currently written.

**Fix Options**:
1. Add a `deposit_from(from: Address, amount: i128)` method that allows admin-authorized deposits from any address
2. All deposits route through the platform admin (defeats the decentralization purpose)
3. The backend escrow service doesn't actually call the Soroban contract for deposits — it uses Horizon direct transfers to the escrow public key. The Soroban contract tracks state separately. This creates a **dual-truth problem**.


---

## Section 5: Security Audit

### 5.1 Fixed Since Previous Audit

| Finding | Status |
|---------|--------|
| Secret key stored as Base64 (not encrypted) | ✅ FIXED — `encryptSecret()` now called |
| Disbursement XDR never signed | ✅ FIXED — `Keypair.fromSecret()` + `tx.sign()` |
| Refund XDR never signed | ✅ FIXED — same pattern applied |

### 5.2 Remaining Security Issues

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | No rate limiting on any endpoint | 🔴 Critical | Open |
| 2 | No MFA for financial operations (mainnet disburse) | 🔴 Critical | Open |
| 3 | PermissionEngine sparse — 7 of 10 roles have no rules | 🟠 High | Open |
| 4 | Double-disbursement race condition (no mutex/lock) | 🟠 High | NEW |
| 5 | Wallet removal has no active-escrow check | 🟠 High | NEW |
| 6 | Login page uses hardcoded light colors — doesn't use theme | 🟡 Medium | NEW |
| 7 | No CAPTCHA on login/signup | 🟡 Medium | Open |
| 8 | CSP allows `unsafe-inline` for styles (Tailwind requirement) | 🟡 Medium | Accepted |
| 9 | Domain event publisher catches errors silently | 🟡 Medium | Open |
| 10 | No Content-Length limit on API request bodies | 🟡 Medium | Open |

### 5.3 CSP & Headers Assessment

| Header | Value | Assessment |
|--------|-------|------------|
| Content-Security-Policy | Nonce-based scripts, `strict-dynamic` in prod | ✅ Good |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | ✅ Good |
| X-Content-Type-Options | `nosniff` | ✅ Good |
| X-Frame-Options | `DENY` | ✅ Good |
| Referrer-Policy | `strict-origin-when-cross-origin` | ✅ Good |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | ✅ Good |
| X-Request-Id | UUID per request | ✅ Good |

### 5.4 Wallet Security

| Check | Status |
|-------|--------|
| Stellar address regex validation (DB CHECK) | ✅ `^G[A-Z2-7]{55}$` |
| Challenge-response wallet verification | ✅ 5-min nonce expiry |
| Private key never exposed to frontend | ✅ server-only + KMS |
| Escrow secret encrypted at rest | ✅ AES-256-GCM (dev) / KMS (prod) |
| LOCAL_ENCRYPTION_KEY required (no fallback) | ✅ Fail-fast if missing |
| Network mismatch prevention | ✅ Wallet connection checks network |
| Mainnet disabled by default | ✅ `STELLAR_MAINNET_ENABLED` flag |


---

## Section 6: Business Logic Audit

### 6.1 State Machine Integrity

**Event Lifecycle (16 states)**:
- State machine is pure (no I/O), well-documented, with precondition-based transitions
- Each transition validates: actor role, escrow state, judge count, submission status, dispute status
- ✅ Strong design pattern

**Escrow Lifecycle (9 states)**:
- Mirrors event lifecycle with reconciliation guards
- `inconsistent` flag blocks automated transitions but allows manual resolution
- ✅ Well thought out

**Dispute Lifecycle (5 states)**:
- Role-gated transitions (filer can Withdraw, organizer/admin can Uphold/Dismiss)
- ✅ Correct

**State Mismatch Issue** (from previous audit — still partially open):
- DB allows 18 event states (includes `Suspended` and `Archived` beyond the 16 documented)
- Soroban contract has 6 states
- Backend state machine covers 16 states
- The `Suspended` state exists in DB CHECK but has no transition paths in the state machine

### 6.2 Domain Event Consistency

The `publishDomainEvent` function handles:
- `TeamCreated` → audit record
- `TeamJoinRequestResolved` → audit + notification to user
- `SubmissionCreated` → audit record
- `FundingCompleted` → audit record
- `PrizeReleased` → audit record

**Issues**:
1. **Fire-and-forget**: `publishDomainEvent` catches all errors and logs them. If audit/notification fails, the main operation still succeeds but side effects are lost. For a financial platform, audit loss is unacceptable.
2. **No event persistence**: Events are processed inline, not queued. If the process crashes between the main operation and the event handler, the side effect is lost permanently.
3. **No replay mechanism**: If an event handler fails, there's no way to replay it.

### 6.3 Financial Precision

| Check | Status | Notes |
|-------|--------|-------|
| `numeric` type for amounts | ✅ | But no precision specified |
| Stellar uses 7 decimal places (stroops) | ⚠️ | No `numeric(20,7)` constraint |
| Rounding strategy defined | ❌ | No explicit rounding in allocation |
| Transaction fees accounted | ❌ | Stellar base fee not subtracted from expected_balance |
| Minimum account balance (reserve) | ❌ | Stellar requires min 1 XLM for account — not checked before disbursement |

---

## Section 7: Role & Permission Audit

### 7.1 Defined Roles

| Role | DB Location | PermissionEngine | Route Guards | RLS |
|------|-------------|-----------------|--------------|-----|
| PlatformAdmin | users.is_platform_admin | ✅ (1 rule) | ✅ | ✅ |
| WorkspaceOwner | workspace_members.role | ❌ | ⚠️ Legacy | ✅ |
| WorkspaceAdmin | workspace_members.role | ❌ | ⚠️ Legacy | ✅ |
| Organizer | event_members.role | ✅ (1 rule) | ✅ | ✅ |
| Judge | event_members.role | ✅ (2 rules) | ✅ | ✅ |
| Participant | event_members.role | ❌ | ⚠️ Legacy | ✅ |
| Sponsor | event_members.role | ❌ | ❌ | ✅ |
| Mentor | event_members.role | ❌ | ❌ | ✅ |
| TeamCaptain | teams.captain_id | ❌ | ⚠️ Manual | ❌ |
| TeamMember | team_members.user_id | ❌ | ❌ | ❌ |

**Assessment**: RLS provides the actual security floor. The PermissionEngine is aspirational but incomplete. The system is secure at the DB level but the application layer has inconsistent enforcement.


---

## Section 8: Edge Cases & Failure Scenarios

### 8.1 Critical Failure Scenarios

| Scenario | Handled? | Impact if Unhandled |
|----------|----------|---------------------|
| KMS unavailable during disbursement | ✅ | Aborts with notification to organizer |
| Stellar Horizon down during funding verification | ⚠️ | Error thrown but no retry/queue mechanism |
| Stellar Horizon down during disbursement | ✅ | Retry with exponential backoff (refund only, disbursement has no retry) |
| Database unavailable mid-disbursement | ❌ | Funds sent on-chain but DB not updated — inconsistency |
| User removes wallet after winning but before disbursement | ✅ | Winner marked "held" |
| User changes wallet after winning | ⚠️ | Pays to wallet at disbursement time, not at winning time |
| Event cancelled after partial disbursement | ❌ | No rollback mechanism for already-sent payments |
| Two organizers trigger disburse simultaneously | ❌ | Double payment (see Section 3.4) |
| Browser refresh during event creation wizard | ✅ | localStorage draft persists |
| Browser refresh during wallet connection | ⚠️ | Flow resets — user must start over |
| Escrow account balance drained externally | ✅ | Reconciliation detects, sets `inconsistent` flag |

### 8.2 Data Consistency Scenarios

| Scenario | Protection | Gap |
|----------|-----------|-----|
| Event deleted with active escrow | `ON DELETE RESTRICT` | ✅ |
| User deleted with team membership | `ON DELETE CASCADE` | ⚠️ Orphaned team possible |
| Workspace deleted with events | `ON DELETE RESTRICT` | ✅ |
| Duplicate submission in same event | No unique constraint on (event_id, submitter_id) | ❌ Multiple subs possible |
| Same user as Judge AND Participant | Partial unique index enforces exclusion | ✅ |

---

## Section 9: Missing Features

### 9.1 Critical Missing (Block Production)

1. **Rate limiting** — No protection against brute force or API abuse
2. **Signup page** — Cannot onboard new users
3. **MFA for financial ops** — Mainnet disbursement must require additional verification
4. **Disbursement idempotency** — Double-spend vulnerability
5. **Registration deadline auto-transition** — Documented but not implemented
6. **Terms of Service / Privacy Policy pages** — Linked in footer but no content

### 9.2 High Priority Missing

7. **Email notifications** — Service exists but no email templates/sending configured
8. **Admin dashboard** — No `/admin` routes found
9. **Workspace creation page** — Referenced but not found
10. **Mentor-specific features** — Role exists but no workflow
11. **Sponsor dashboard** — No sponsor-specific views
12. **Team prize splitting** — No mechanism to distribute team prizes
13. **Export functionality** — API route exists, unclear if UI triggers it
14. **Webhook delivery** — Schema exists but no delivery mechanism found

### 9.3 Medium Priority Missing

15. Waitlist support
16. Event capacity limits
17. Multi-track events
18. Eligibility rules engine
19. Real-time collaboration (comments on submissions)
20. Certificate/badge generation for participants
21. Analytics dashboard for organizers
22. Public organizer profiles
23. OAuth login (Google, GitHub)
24. Event duplication/templating (hook `use-event-templates.ts` exists)


---

## Section 10: Prioritized Issues

### 🔴 Critical (Must Fix Before Any Live Usage)

| # | Issue | Location | Fix Effort |
|---|-------|----------|------------|
| C1 | Double-disbursement race condition | disbursement.service.ts | Medium |
| C2 | No rate limiting on any endpoint | middleware.ts | Medium |
| C3 | No signup page | web/app/(auth)/signup/ | Low |
| C4 | Soroban contract partial-disburse breaks (Released after first batch) | contracts/escrow/src/lib.rs | High |
| C5 | Backend/Contract state mismatch (9 vs 6 states) | Architecture | High |
| C6 | Backend/Contract deposit auth mismatch (any wallet vs organizer-only) | Architecture | High |
| C7 | No MFA for mainnet financial operations | Auth system | Medium |
| C8 | No DB transaction boundaries on financial ops | Services | High |

### 🟠 High (Must Fix Before Beta Users)

| # | Issue | Location | Fix Effort |
|---|-------|----------|------------|
| H1 | PermissionEngine only covers 3/10 roles | permission-engine.ts | Medium |
| H2 | Login page breaks dark mode (hardcoded neutral colors) | login/page.tsx | Low |
| H3 | Domain event publisher loses events silently | publisher.ts | Medium |
| H4 | No duplicate winner constraint | winners table migration | Low |
| H5 | Team prize splitting undefined | Business logic | Medium |
| H6 | No terms/privacy pages (linked in footer) | Pages | Low |
| H7 | Wallet removal doesn't check active escrow assignments | settings page + API | Low |
| H8 | No disbursement retry (only refund has retry logic) | disbursement.service.ts | Medium |
| H9 | Registration deadline not auto-enforced | Cron/trigger | Medium |
| H10 | Stellar account minimum reserve not checked | disbursement.service.ts | Low |

### 🟡 Medium (Fix Before Public Launch)

| # | Issue | Location | Fix Effort |
|---|-------|----------|------------|
| M1 | No workspace creation page | web/app/ | Low |
| M2 | No admin dashboard | web/app/ | High |
| M3 | No email sending configured | email.ts | Medium |
| M4 | `FormEvent` deprecated warning | Multiple pages | Low |
| M5 | No CAPTCHA on auth forms | Login/signup | Low |
| M6 | Numeric columns lack precision (should be `numeric(20,7)`) | Migrations | Low |
| M7 | No tie-breaking logic in winner selection | Business logic | Medium |
| M8 | Dispute can block disbursement indefinitely (no deadline) | dispute.ts | Low |
| M9 | No account deletion (GDPR) | Settings + API | Medium |
| M10 | TeamFormationLocked name confusion | Naming/docs | Low |


---

## Section 11: Recommended Improvements

### 11.1 Architecture

1. **Consolidate authorization**: Remove legacy `requireEventRole`/`requireWorkspaceRole`. Complete the PermissionEngine with all 10 roles and use it exclusively.
2. **Event sourcing for financials**: Replace fire-and-forget domain events with a persistent event store (even a Postgres table acting as an outbox). Critical for audit compliance.
3. **Add database transactions**: Wrap multi-step financial operations (disburse, refund, fund) in Supabase RPC functions that use `BEGIN/COMMIT`.
4. **Resolve Soroban dual-truth**: Either use the Soroban contract as the single source of truth for escrow state, or remove it and use Horizon-only. Currently both exist but don't communicate.

### 11.2 Security

1. **Add rate limiting**: Redis-backed sliding window (e.g., `@upstash/ratelimit`) at middleware level.
2. **Disbursement mutex**: Use `idempotency_keys` table or PostgreSQL advisory locks to prevent concurrent disbursement executions.
3. **MFA**: Supabase Auth supports TOTP MFA — require it for mainnet financial operations.
4. **Input size limits**: Add `Content-Length` check in middleware (reject >1MB request bodies).
5. **API key auth for cron endpoints**: `/api/cron/*` routes should require a secret header, not just be "public".

### 11.3 Financial

1. **Precision**: Change `numeric` columns to `numeric(20,7)` for Stellar-native precision.
2. **Fee accounting**: Deduct Stellar base fee (100 stroops per operation) from expected balance calculations.
3. **Minimum reserve check**: Before disbursement, verify escrow account retains minimum Stellar reserve (currently 1 XLM for the account + 0.5 XLM per trustline).
4. **Team splits**: Add a `prize_split_policy` field to events: "captain_receives", "equal_split", "custom_allocation".
5. **Disbursement retry**: Mirror the refund service's retry logic in the disbursement service.

### 11.4 UX

1. **Add signup page**: Mirror login structure with name field + email confirmation flow.
2. **Fix login dark mode**: Replace `bg-neutral-50`, `text-neutral-900` etc. with CSS variables.
3. **Add breadcrumbs**: Event sub-pages should show: Events > [Event Name] > Teams/Submissions/etc.
4. **Add "Discard draft" to event wizard**: Allow users to clear localStorage and start fresh.
5. **Escrow explainer**: Add a visual diagram showing the escrow lifecycle on the landing page and event detail page.
6. **Progress indicators**: Show judge evaluation progress, submission counts, and funding percentage on event detail page.

---

## Section 12: Final Production Readiness Assessment

### What Works Well

- ✅ Clean architecture with separation of concerns (services, repositories, state machines, engines)
- ✅ Comprehensive database schema with proper constraints
- ✅ Immutable audit trail
- ✅ KMS-encrypted escrow keys (fixed)
- ✅ Transaction signing (fixed)
- ✅ Retry logic on refunds with exponential backoff
- ✅ Optimistic concurrency control on all mutations
- ✅ Strong security headers (CSP, HSTS, X-Frame-Options)
- ✅ Thoughtful UI with theme support, accessibility basics, empty/loading states
- ✅ Event lifecycle state machine with precondition guards
- ✅ Public escrow verification endpoint (transparency)
- ✅ Cursor-based pagination on discovery
- ✅ Domain event publisher for decoupled side effects
- ✅ Wallet challenge-response verification
- ✅ Well-structured Create Event wizard with draft persistence

### What Blocks Production

1. **Security**: No rate limiting, no MFA, double-spend vulnerability
2. **Completeness**: Missing signup page, admin panel, workspace creation page
3. **Financial integrity**: No DB transactions, no disbursement idempotency, precision issues
4. **Blockchain consistency**: Soroban contract doesn't match backend logic (state count, deposit auth)
5. **Testing**: ~20 test files for a financial platform is critically insufficient

---

## Final Score

| Category | Score |
|----------|-------|
| Architecture & Code Quality | 60/100 |
| Security | 55/100 |
| Financial Workflow Integrity | 55/100 |
| Smart Contract Safety | 50/100 |
| UI/UX Completeness | 50/100 |
| Testing & Quality Assurance | 35/100 |
| Production Infrastructure | 40/100 |
| User Journey Completeness | 55/100 |
| **Weighted Overall** | **52/100** |

**Verdict**: **NOT PRODUCTION READY** — Early Beta quality. The platform has strong architectural foundations and the critical financial signing bugs are fixed, but security gaps (rate limiting, double-spend, MFA), missing user-facing pages (signup, admin, workspace creation), and the Soroban contract inconsistencies must be resolved before any real users or real XLM touch this system.

**Path to Production** (estimated effort):
- 🔴 Critical fixes: ~2 weeks
- 🟠 High priority: ~3 weeks
- 🟡 Medium priority: ~2 weeks
- Testing to acceptable coverage (>60%): ~3 weeks
- **Total estimated: 8-10 weeks** to reach a Production Readiness Score of 75+.
