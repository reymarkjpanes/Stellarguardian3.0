# StellarGuardian 3.0 — Complete Implementation Plan

## Overview

This document is the single-source execution plan to take StellarGuardian 3.0 from its
current state (42/100 readiness) to production-ready (85+/100). It is organized into
**6 Phases**, each containing numbered tasks with exact file paths, code changes needed,
acceptance criteria, and dependency ordering.

**Estimated Total Effort**: 10-13 weeks (1 senior engineer full-time, or 5-6 weeks with 2 engineers)

---

## Phase 0: Critical Blockers (Week 1)
*These 6 items MUST be fixed before any other work. They represent data loss, security,
or complete feature breakage risks.*


### Task 0.1: Fix Escrow Secret Key Encryption
**Priority**: 🔴 CRITICAL | **Effort**: 2 hours | **Dependencies**: None

**Problem**: `FundingService.createEscrowAccount()` stores the secret key as plain Base64.
If the database is compromised, all escrow funds are immediately stealable.

**File**: `web/lib/services/escrow/funding.service.ts`

**Change**:
```typescript
// BEFORE (INSECURE):
const encryptedSecret = Buffer.from(secretKey).toString("base64");

// AFTER (SECURE):
import { encryptSecret } from "@/lib/services/kms";
const encryptedSecret = await encryptSecret(secretKey);
```

**Acceptance Criteria**:
- [ ] `createEscrowAccount` calls `encryptSecret()` from KMS service
- [ ] Stored value starts with `kms:` (prod) or `aes:` (dev)
- [ ] Unit test verifies encrypted output is NOT plain Base64
- [ ] Existing escrow accounts with Base64 keys have a migration script

---

### Task 0.2: Fix Transaction Signing in Disbursement
**Priority**: 🔴 CRITICAL | **Effort**: 4 hours | **Dependencies**: Task 0.1

**Problem**: `DisbursementService` builds unsigned XDR then submits it. Stellar rejects
unsigned transactions. All disbursements fail silently.

**File**: `web/lib/services/escrow/disbursement.service.ts`

**Change**: After `buildPaymentBatch`, decrypt the escrow key and sign before submission.

```typescript
// Add to DisbursementService.executeDisbursement():
import { decryptSecret } from "@/lib/services/kms";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

// After buildPaymentBatch returns unsigned XDR:
const escrowSecret = await decryptSecret(escrow.encrypted_secret_key.toString());
const keypair = Keypair.fromSecret(escrowSecret);
const networkPassphrase = stellar.getNetworkMode() === "mainnet"
  ? "Public Global Stellar Network ; September 2015"
  : "Test SDF Network ; September 2015";
const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
tx.sign(keypair);
const signedXdr = tx.toXDR();
const { hash, successful } = await stellar.submitSignedTx(signedXdr);
```

**Also fix in**: `web/lib/services/escrow/refund.service.ts` (same pattern)

**Acceptance Criteria**:
- [ ] Disbursement signs XDR with decrypted escrow keypair before submission
- [ ] Refund signs XDR with decrypted escrow keypair before submission
- [ ] Integration test mocks Stellar and verifies signed XDR is submitted
- [ ] Error handling covers KMS decryption failure (notify admin, don't proceed)

---


### Task 0.3: Align Event State Model (DB ↔ Zod ↔ State Machine)
**Priority**: 🔴 CRITICAL | **Effort**: 1.5 days | **Dependencies**: None

**Problem**: DB CHECK allows 18 states, Zod validates 5 states, design specifies 16.
API responses containing DB records with state `RegistrationOpen` will fail Zod validation.

**Files to modify**:
1. `web/types/enums.ts` — Expand `EventStateSchema`
2. `web/lib/state-machine/event.ts` — Create full 16-state lifecycle machine (new file)
3. `web/lib/engines/workflow/event-workflow.ts` — Refactor to use 16-state machine
4. `web/components/events/event-lifecycle-stepper.tsx` — Update UI
5. `web/supabase/migrations/` — New migration to remove `Review` and `Suspended` if unused

**Step 1**: Update `web/types/enums.ts`:
```typescript
export const EventStateSchema = z.enum([
  "Draft",
  "Published",
  "RegistrationOpen",
  "RegistrationClosed",
  "TeamFormationLocked",
  "SubmissionOpen",
  "SubmissionClosed",
  "JudgingRound1",
  "JudgingRound2",
  "WinnerVerification",
  "DisputeWindow",
  "PrizeApproved",
  "EscrowRelease",
  "Completed",
  "Cancelled",
  "Archived",
]);
```

**Step 2**: Create `web/lib/state-machine/event.ts` with full transition graph
mirroring the design document's precondition table.

**Step 3**: Update `event-lifecycle-stepper.tsx` to display the full lifecycle
with phase groupings (Setup → Registration → Building → Judging → Prizes → Complete).

**Acceptance Criteria**:
- [ ] `EventStateSchema` has 16 values matching the DB CHECK constraint
- [ ] `canEventTransition(from, to, ctx)` pure function exists
- [ ] Property-based test verifies no impossible transitions
- [ ] Event lifecycle stepper renders all phases correctly
- [ ] Existing events with the 5-state model still render (backward compat)

---

### Task 0.4: Fix Migration Conflict (000005 vs 000048)
**Priority**: 🔴 CRITICAL | **Effort**: 1 day | **Dependencies**: None

**Problem**: Migration 000048 `DROP TABLE escrow_accounts` then recreates with different
schema (PostgreSQL ENUMs vs text CHECK). The services in `lib/services/escrow/` reference
columns from migration 000005's schema. Running both creates table conflicts.

**Decision Required**: Choose ONE escrow schema.

**Recommended approach**: Keep migration 000005's schema (text CHECK, matches existing
service code) and **remove or conditionally skip** migration 000048 for now.

**Files**:
1. `web/supabase/migrations/20250101000048_module8_escrow_domain.sql` — Mark as applied
   or refactor to not conflict
2. Create new migration `20250101000049_module8_compat.sql` that adds Module 8 tables
   WITHOUT dropping the existing escrow_accounts

**Alternative**: If Module 8 schema is preferred, update ALL service code to use the new
column names (`status` instead of `state`, `available_balance` instead of `last_reconciled_balance`, etc.)

**Acceptance Criteria**:
- [ ] `supabase db reset` runs cleanly with no table conflicts
- [ ] All 42+ migrations can be applied to a fresh database in sequence
- [ ] Services in `lib/services/escrow/` work against the final schema
- [ ] Down migration exists for the resolution migration

---


### Task 0.5: Add Transaction Boundaries to Financial Operations
**Priority**: 🔴 CRITICAL | **Effort**: 1 day | **Dependencies**: Task 0.4

**Problem**: Financial operations perform multiple DB writes without transactions.
If one write fails mid-operation, the system is in an inconsistent state.

**Solution**: Use Supabase RPCs (PostgreSQL functions with `SECURITY DEFINER`) to
wrap multi-step financial operations atomically.

**Files to create/modify**:
1. New migration: `web/supabase/migrations/20250101000050_financial_transactions.sql`
2. `web/lib/services/escrow/funding.service.ts` — Use RPC instead of multi-write
3. `web/lib/services/escrow/disbursement.service.ts` — Same
4. `web/lib/services/escrow/refund.service.ts` — Same

**Pattern** (already used by `fund_escrow` RPC):
```sql
CREATE OR REPLACE FUNCTION public.complete_disbursement(
  p_event_id uuid,
  p_escrow_id uuid,
  p_payments jsonb,
  p_actor_id uuid
) RETURNS jsonb AS $$
BEGIN
  -- Update escrow state
  -- Insert transaction records
  -- Update winner statuses
  -- Write audit record
  -- All within a single transaction
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Acceptance Criteria**:
- [ ] All financial state changes happen within a single database transaction
- [ ] If any step fails, entire operation rolls back
- [ ] Audit record is always written (within same transaction)
- [ ] Integration test verifies partial failure causes full rollback

---

### Task 0.6: Implement Signup Page
**Priority**: 🔴 CRITICAL | **Effort**: 4 hours | **Dependencies**: None

**Problem**: Users literally cannot create accounts. The `/signup` link in the login
page leads to a non-existent route.

**File to create**: `web/app/(auth)/signup/page.tsx`

**Implementation**:
- Client Component (needs form interactivity)
- Fields: display_name, email, password, confirm password
- Uses `supabase.auth.signUp({ email, password, options: { data: { display_name } } })`
- On success: redirect to email verification page or dashboard
- Match login page styling (same layout, same form patterns)

**Also create**: `web/app/(auth)/forgot-password/page.tsx`
- Uses `supabase.auth.resetPasswordForEmail(email)`
- Simple form: email input + submit

**Acceptance Criteria**:
- [ ] `/signup` renders a registration form
- [ ] Successful signup creates a Supabase auth user
- [ ] Error states shown for: weak password, duplicate email, network error
- [ ] `/forgot-password` sends a reset email
- [ ] Both pages match the visual style of `/login`

---

## Phase 1: Security & Auth Hardening (Week 2)
*Fix authorization gaps, complete the permission system, harden secrets management.*


### Task 1.1: Complete Permission Engine for All 10 Roles
**Priority**: 🟠 HIGH | **Effort**: 2 days | **Dependencies**: None

**Problem**: `PermissionEngine` only defines rules for 3 of 10 roles. The remaining 7
roles (`WorkspaceOwner`, `WorkspaceAdmin`, `Sponsor`, `Mentor`, `Participant`,
`TeamCaptain`, `TeamMember`) all return `false` for every action.

**File**: `web/lib/engines/permission/permission-engine.ts`

**Change**: Populate the MATRIX with rules for all roles × resources × actions:

| Role | Events | Submissions | Evaluations | Teams | Escrow | Disputes |
|------|--------|-------------|-------------|-------|--------|----------|
| PlatformAdmin | CRUD + freeze | read | read | read | read | read + resolve |
| WorkspaceOwner | CRUD | read | read | read | fund + read | resolve |
| WorkspaceAdmin | CRUD | read | read | read | fund + read | resolve |
| Organizer | CRU (pre-reg) | read | read | read | fund | resolve |
| Sponsor | read | ❌ | ❌ | ❌ | read | ❌ |
| Judge | read | read + evaluate | CRU | ❌ | ❌ | ❌ |
| Mentor | read | read | ❌ | read | ❌ | ❌ |
| Participant | read | create + update own | ❌ | join/leave | ❌ | file |
| TeamCaptain | read | create + update | ❌ | manage | ❌ | file |
| TeamMember | read | update (team sub) | ❌ | leave | ❌ | ❌ |

**Also**: Deprecate `lib/auth/permissions.ts` — make all route handlers use the unified
`PermissionEngine.can()` / `PermissionEngine.require()`.

**Acceptance Criteria**:
- [ ] All 10 roles have defined permissions for all resource categories
- [ ] ABAC rules enforce context (e.g., organizer can't edit after RegistrationClosed)
- [ ] Route handlers migrate from `requireEventRole` to `PermissionEngine.require()`
- [ ] Unit tests cover every role × resource × action combination (matrix test)
- [ ] 403 responses include audit log entries

---

### Task 1.2: Remove Legacy XOR Encryption + Migrate Existing Keys
**Priority**: 🟠 HIGH | **Effort**: 4 hours | **Dependencies**: Task 0.1

**File**: `web/lib/services/kms.ts`

**Changes**:
1. Remove `legacyDecrypt()` function
2. Add a one-time migration script: `web/scripts/migrate-escrow-keys.ts`
   - Reads all escrow accounts with non-prefixed encrypted_secret_key
   - Decrypts with legacy XOR
   - Re-encrypts with `encryptSecret()`
   - Updates the row
3. Remove the hardcoded default `LOCAL_ENCRYPTION_KEY` value
4. Require `LOCAL_ENCRYPTION_KEY` env var in dev (fail fast if missing)

**Acceptance Criteria**:
- [ ] No legacy XOR code path remains
- [ ] Migration script handles all existing records
- [ ] `encryptSecret()` throws if `LOCAL_ENCRYPTION_KEY` is not set in dev
- [ ] Production guard (`KMS_KEY_ARN` required) remains intact

---

### Task 1.3: Restrict Overly Permissive RLS Policies
**Priority**: 🟠 HIGH | **Effort**: 4 hours | **Dependencies**: Task 0.4

**Problem**: Module 8 migration sets `USING (true)` on `escrow_accounts`, 
`payout_batches`, `payout_instructions`, `wallet_verifications` — making all
financial data publicly readable.

**File**: New migration `web/supabase/migrations/20250101000051_restrict_financial_rls.sql`

**Change**: Replace `USING (true)` with proper workspace-member or event-member scoping:
```sql
DROP POLICY "escrows_select" ON public.escrow_accounts;
CREATE POLICY "escrows_select" ON public.escrow_accounts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.workspace_members wm ON wm.workspace_id = e.workspace_id
    WHERE e.id = event_id AND wm.user_id = (SELECT auth.uid())
  )
);
```

**Acceptance Criteria**:
- [ ] Financial tables only readable by workspace members
- [ ] Public escrow verification endpoint still works (uses service client)
- [ ] No anonymous user can query payout_instructions

---

### Task 1.4: Add Optimistic Concurrency Enforcement
**Priority**: 🟡 MEDIUM | **Effort**: 1 day | **Dependencies**: None

**Problem**: `version` columns exist but aren't checked on updates. Concurrent edits
overwrite each other silently.

**Files to modify**: All route handlers that update mutable resources.

**Pattern**:
```typescript
// In route handler:
const { version, ...updateData } = body;
const { data, error } = await supabase
  .from("events")
  .update({ ...updateData, version: version + 1 })
  .eq("id", eventId)
  .eq("version", version) // Optimistic lock
  .select()
  .single();

if (!data) throw new ConflictError("Resource was modified. Refresh and retry.");
```

**Also add** `VersionConflictError` to `web/lib/errors/errors.ts`:
```typescript
export class VersionConflictError extends AppError {
  readonly code = "VERSION_CONFLICT";
  readonly httpStatus = 409;
}
```

**Acceptance Criteria**:
- [ ] All update operations on versioned resources include `WHERE version = ?`
- [ ] 409 returned when version mismatch detected
- [ ] Client receives the stale version info to allow re-fetch

---

## Phase 2: Core UX Completeness (Weeks 2-3)
*Build the missing pages and user journeys that block adoption.*


### Task 2.1: Workspace Creation Flow
**Priority**: 🟠 HIGH | **Effort**: 1 day | **Dependencies**: None

**Files to create**:
- `web/app/(app)/workspaces/new/page.tsx` — Server Component with form
- `web/app/api/workspaces/route.ts` — POST handler (if not exists)

**Functionality**:
- Form: name, slug (auto-generated from name, editable), description
- On submit: create workspace + add creator as Owner in workspace_members
- Redirect to `/workspaces/[slug]` on success
- Validate slug uniqueness client-side and server-side

---

### Task 2.2: Workspace Management Page
**Priority**: 🟠 HIGH | **Effort**: 2 days | **Dependencies**: Task 2.1

**Files to create**:
- `web/app/(app)/workspaces/[slug]/page.tsx` — Workspace dashboard
- `web/app/(app)/workspaces/[slug]/members/page.tsx` — Member management
- `web/app/(app)/workspaces/[slug]/settings/page.tsx` — Workspace settings
- `web/components/workspace/member-table.tsx` — Member list with role management
- `web/components/workspace/invite-member-dialog.tsx` — Invite by email

**Functionality**:
- Workspace dashboard: list of events, member count, quick actions
- Member management: invite, change role, remove (Owners/Admins only)
- Settings: name, description, timezone, defaults
- Wire to existing `invitation.ts` service for email invites

---

### Task 2.3: Notification Inbox Page
**Priority**: 🟠 HIGH | **Effort**: 1 day | **Dependencies**: None

**Files to create**:
- `web/app/(app)/notifications/page.tsx` — Inbox view
- `web/components/notifications/notification-list.tsx` — Rendered list
- `web/components/layout/notification-bell.tsx` — Nav icon with unread count

**Functionality**:
- Server Component fetches notifications ordered by created_at DESC
- Cursor-based pagination (default 20)
- Category filter tabs (All, Escrow, Disputes, Teams, System)
- Mark as read (single + mark all)
- Realtime subscription for new notifications (client-side)
- Bell icon in `app-nav.tsx` with unread count badge

---

### Task 2.4: Workspace Switcher in Navigation
**Priority**: 🟡 MEDIUM | **Effort**: 4 hours | **Dependencies**: Task 2.1

**File to modify**: `web/components/layout/app-nav.tsx`

**Change**: Add dropdown showing all workspaces the user belongs to.
Selecting a workspace navigates to `/workspaces/[slug]` and optionally
stores a "current workspace" preference in localStorage.

---

### Task 2.5: Event Sub-Navigation (Tabs/Sidebar)
**Priority**: 🟠 HIGH | **Effort**: 4 hours | **Dependencies**: None

**File to create**: `web/app/(app)/events/[id]/layout.tsx`

**Implementation**: Wrap all event sub-pages in a layout with:
- Event title + state badge at the top
- Horizontal tab bar: Overview | Members | Teams | Submissions | Judging | Prizes | Escrow | Disputes
- Active tab highlighted based on current pathname
- Responsive: horizontal scroll on mobile

---

### Task 2.6: Loading and Error Boundaries
**Priority**: 🟠 HIGH | **Effort**: 1 day | **Dependencies**: None

**Files to create** (one per route group):
- `web/app/(app)/loading.tsx`
- `web/app/(app)/error.tsx`
- `web/app/(app)/events/[id]/loading.tsx`
- `web/app/(app)/events/[id]/error.tsx`
- `web/app/(app)/dashboard/loading.tsx`
- `web/app/(app)/workspaces/[slug]/loading.tsx`

**Pattern**:
```tsx
// loading.tsx — Skeleton matching page layout
export default function Loading() {
  return <div className="animate-pulse space-y-4">...</div>;
}

// error.tsx — Recoverable error with retry
"use client";
export default function Error({ error, reset }) {
  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

### Task 2.7: Terms of Service & Privacy Policy Pages
**Priority**: 🟠 HIGH | **Effort**: 4 hours | **Dependencies**: None

**Files to create**:
- `web/app/(public)/terms/page.tsx`
- `web/app/(public)/privacy/page.tsx`

**Content**: Placeholder legal text with proper markdown rendering.
Mark as public routes (already in middleware PUBLIC_PATHS).

---

## Phase 3: Financial Workflow Completion (Weeks 3-4)
*Wire the escrow lifecycle end-to-end; add missing financial services.*


### Task 3.1: Implement Full Event State Machine
**Priority**: 🟠 HIGH | **Effort**: 2 days | **Dependencies**: Task 0.3

**File to create**: `web/lib/state-machine/event.ts`

**Implementation**: Full 16-state graph with preconditions per edge.
Mirror the dispute/escrow state machine pattern (pure function, no I/O).

```typescript
export function canEventTransition(
  from: EventState,
  to: EventState,
  ctx: EventTransitionContext
): TransitionResult { ... }
```

**Key Transitions with Preconditions**:
- Draft → Published: judgeCount ≥ 1, registrationDeadline set
- Published → RegistrationOpen: (automatic on publish date)
- RegistrationOpen → RegistrationClosed: deadline passed OR manual
- RegistrationClosed → TeamFormationLocked: all participants assigned
- TeamFormationLocked → SubmissionOpen: teamSizeMin met per team
- SubmissionOpen → SubmissionClosed: deadline OR manual
- SubmissionClosed → JudgingRound1: hasSubmissions
- JudgingRound1 → WinnerVerification: allSubmissionsScored
- WinnerVerification → DisputeWindow: winners confirmed
- DisputeWindow → PrizeApproved: reviewWindowElapsed AND unresolvedDisputes === 0
- PrizeApproved → EscrowRelease: escrowFullyFunded AND escrowLocked
- EscrowRelease → Completed: allDisbursementsComplete
- Any → Cancelled: organizerOrAdmin (triggers refund if funded)
- Completed/Cancelled → Archived: manual

**Acceptance Criteria**:
- [ ] Property-based tests with fast-check (100+ random transition sequences)
- [ ] `validOutboundStates(from, ctx)` returns correct set for any state
- [ ] Terminal states (Completed, Cancelled, Archived) have no outbound edges
- [ ] Consistent `TransitionResult` type matches escrow/dispute modules

---

### Task 3.2: Implement Settlement Service
**Priority**: 🟠 HIGH | **Effort**: 1 day | **Dependencies**: Task 0.5

**File to create**: `web/lib/services/escrow/settlement.service.ts`

**Functionality**:
- Called when escrow reaches `Released` or `Refunded` terminal state
- Records final settlement in `settlements` table
- Computes discrepancy (expected vs. actual paid)
- Generates settlement summary (total funded, total disbursed, fees, remainder)

```typescript
export class SettlementService {
  static async recordSettlement(escrowId: string, actorId: string): Promise<Settlement> {
    // 1. Fetch all transactions for this escrow
    // 2. Sum fund transactions, sum disbursement transactions
    // 3. Calculate discrepancy
    // 4. Insert settlement record
    // 5. Write audit record
  }
}
```

---

### Task 3.3: Implement Periodic Reconciliation Cron
**Priority**: 🟠 HIGH | **Effort**: 4 hours | **Dependencies**: None

**File to create**: `web/app/api/cron/reconcile/route.ts`

**Implementation**:
- Secured with a CRON_SECRET header (Vercel Cron or external scheduler)
- Queries all escrow accounts in non-terminal states (not Released/Refunded)
- For each: calls `VerificationService.reconcileEscrow(eventId)`
- If inconsistency detected: notification already sent by service
- Log summary: total checked, total inconsistent

**Also add** to `vercel.json` or cron configuration:
```json
{ "path": "/api/cron/reconcile", "schedule": "*/15 * * * *" }
```

---

### Task 3.4: Fix Soroban `queryEscrowState` (Hardcoded Zeros)
**Priority**: 🟠 HIGH | **Effort**: 4 hours | **Dependencies**: None

**File**: `web/lib/stellar/soroban-escrow.ts`

**Problem**: The function returns `BigInt(0)` and `0` regardless of simulation result.

**Fix**: Parse ScVal return values from simulation:
```typescript
import { scValToNative } from "@stellar/stellar-sdk";

// In queryEscrowState:
const balanceResult = (balanceSim as SimulateTransactionSuccessResponse).result;
const balance = balanceResult?.retval 
  ? BigInt(scValToNative(balanceResult.retval)) 
  : BigInt(0);

const stateResult = (stateSim as SimulateTransactionSuccessResponse).result;
const state = stateResult?.retval 
  ? Number(scValToNative(stateResult.retval)) 
  : 0;
```

---

### Task 3.5: Add Fee Accounting
**Priority**: 🟡 MEDIUM | **Effort**: 4 hours | **Dependencies**: Task 0.2

**File**: `web/lib/services/escrow/disbursement.service.ts`

**Change**: After building a payment batch, estimate and track fees:
```typescript
const estimatedFee = BigInt(100) * BigInt(payments.length); // 100 stroops per op
// Deduct from expected balance tracking
// Include in audit record
```

Also update `expected_balance` logic to account for accumulated fees.

---

### Task 3.6: Implement Idempotency Key Cleanup Cron
**Priority**: 🟡 MEDIUM | **Effort**: 2 hours | **Dependencies**: None

**File to create**: `web/app/api/cron/cleanup-idempotency/route.ts`

```typescript
// DELETE FROM idempotency_keys WHERE expires_at < NOW()
const { count } = await supabase
  .from("idempotency_keys")
  .delete()
  .lt("expires_at", new Date().toISOString());
```

---

## Phase 4: Architecture Alignment (Weeks 4-5)
*Resolve the dual architecture, consolidate systems, wire domain events.*


### Task 4.1: Establish Architecture Boundary Rules
**Priority**: 🟠 HIGH | **Effort**: 4 hours | **Dependencies**: None

**Decision**: `lib/` is the application/infrastructure layer. `src/domains/` is the
domain layer. New bounded contexts go in `src/domains/` only.

**File to create**: `web/src/shared/kernel/architecture.md` (documentation)

**Also create**: Architecture fitness test
**File**: `web/lib/__tests__/architecture-fitness.test.ts`

```typescript
import { readdirSync, readFileSync } from "fs";
import { describe, it, expect } from "vitest";

describe("Architecture Fitness", () => {
  it("domain layer does not import infrastructure", () => {
    // Scan src/domains/**/domain/**/*.ts for imports of @supabase, next/, etc.
  });

  it("UI never imports repositories directly", () => {
    // Scan app/**/*.tsx and components/**/*.tsx for imports from lib/repositories
  });

  it("service-only modules are not imported in client code", () => {
    // Scan for imports of server-only modules in client components
  });
});
```

---

### Task 4.2: Consolidate Permission Systems → Single PermissionEngine
**Priority**: 🟠 HIGH | **Effort**: 1 day | **Dependencies**: Task 1.1

**Problem**: Two competing auth systems create confusion.

**Plan**:
1. Complete `PermissionEngine` (Task 1.1)
2. Create `web/lib/auth/authorize.ts` — thin wrapper that builds `PermissionContext` from request
3. Update all route handlers to use `authorize()` instead of `requireEventRole`/`requireWorkspaceRole`
4. Deprecate `lib/auth/permissions.ts` with `@deprecated` JSDoc
5. Remove after all routes migrated

**New authorize helper**:
```typescript
export async function authorize(
  userId: string,
  resourceType: ResourceCategory,
  action: Action,
  context?: Record<string, unknown>
): Promise<void> {
  const roles = await getUserRoles(userId); // from workspace_members + event_members
  const ctx: PermissionContext = {
    userId,
    userRoles: roles,
    resourceCategory: resourceType,
    action,
    attributes: context,
  };
  PermissionEngine.require(ctx); // throws if denied
}
```

---

### Task 4.3: Wire Domain Event Bus with Subscribers
**Priority**: 🟡 MEDIUM | **Effort**: 1 day | **Dependencies**: None

**Problem**: Events are published but no subscribers exist.

**Files to create**:
- `web/lib/events/publisher.ts` — Consolidate to single publish function
- `web/lib/events/subscribers/index.ts` — Bootstrapper that registers all subscribers
- `web/lib/events/subscribers/escrow-events.ts` — Handles FundingCompleted, PrizeReleased
- `web/lib/events/subscribers/notification-events.ts` — Sends notifications on events

**Bootstrapper pattern**:
```typescript
// web/lib/events/subscribers/index.ts
import { eventBus } from "@/lib/domain/events";

export function bootstrapEventSubscribers() {
  eventBus.subscribe("FundingCompleted", handleFundingCompleted);
  eventBus.subscribe("PrizeReleased", handlePrizeReleased);
  eventBus.subscribe("DisputeFiled", handleDisputeFiled);
}
```

**Call from**: `web/app/layout.tsx` or a server-side initialization module.

**Also fix**: Make `eventBus.publish()` await `Promise.allSettled()`:
```typescript
async publish<T>(eventName: string, payload: T) {
  const handlers = this.handlers.get(eventName);
  if (!handlers) return;
  const results = await Promise.allSettled(handlers.map(h => h(payload)));
  // Log failures
  results.filter(r => r.status === "rejected").forEach(r => {
    console.error(`[DomainEventBus] Handler failed for ${eventName}:`, r.reason);
  });
}
```

---

### Task 4.4: Migrate Events Domain to src/domains/
**Priority**: 🟡 MEDIUM | **Effort**: 3 days | **Dependencies**: Task 3.1, 4.1

**Structure to create**:
```
web/src/domains/events/
  domain/
    Event.ts              — Aggregate root
    EventStateMachine.ts  — Re-export from lib/state-machine/event.ts
    EventPhase.ts         — Value object for operational phases
    policies/
      RegistrationPolicy.ts
      TransitionPolicy.ts
  application/
    commands/
      CreateEventCommand.ts
      TransitionEventCommand.ts
      CancelEventCommand.ts
    queries/
      GetEventQuery.ts
      ListEventsQuery.ts
  infrastructure/
    PostgresEventRepository.ts
```

**Note**: This is a gradual migration. Keep `lib/engines/workflow/` working during
transition. New features use the domain model; existing routes continue working.

---

## Phase 5: Testing Push (Weeks 5-7)
*Achieve 70%+ coverage on financial paths, 50%+ overall.*


### Task 5.1: Test Financial Services (Target: 90% Coverage)
**Priority**: 🟠 HIGH | **Effort**: 3 days | **Dependencies**: Phase 0 complete

**Files to create**:
- `web/lib/services/escrow/__tests__/funding.service.test.ts`
- `web/lib/services/escrow/__tests__/refund.service.test.ts`
- `web/lib/services/escrow/__tests__/verification.service.test.ts`
- `web/lib/services/escrow/__tests__/settlement.service.test.ts`
- `web/lib/services/__tests__/idempotency.test.ts`
- `web/lib/services/__tests__/idempotency.property.test.ts`

**Test scenarios for Idempotency**:
- Same key + same body → returns stored response (replay)
- Same key + different body → 409 Conflict
- Expired key → treated as new
- Race condition (two concurrent inserts) → one wins, one replays
- Missing key header → 400

**Test scenarios for Disbursement**:
- Happy path: all winners have verified wallets → all paid
- Partial: some winners lack wallets → paid + held
- Batch splitting: >100 winners → multiple batches
- Failure recovery: one batch fails → held, not double-paid
- Balance validation: sum > on-chain → ValidationError thrown
- Signing: XDR is signed before submission (mock Stellar SDK)

**Test scenarios for Refund**:
- Happy path: refund succeeds on first attempt
- Retry: fails twice, succeeds on third
- Exhaustion: fails 3 times → state=Failed, notification sent
- Zero balance: returns success immediately

---

### Task 5.2: Test Permission Engine (Matrix Test)
**Priority**: 🟠 HIGH | **Effort**: 1 day | **Dependencies**: Task 1.1

**File to create**: `web/lib/engines/permission/__tests__/permission-engine.test.ts`

**Approach**: Generate test cases from the permission matrix:
```typescript
const EXPECTED_PERMISSIONS = [
  { role: "Organizer", resource: "Events", action: "update", state: "Draft", expected: true },
  { role: "Organizer", resource: "Events", action: "update", state: "Completed", expected: false },
  { role: "Judge", resource: "Submissions", action: "evaluate", assigned: true, expected: true },
  { role: "Judge", resource: "Submissions", action: "evaluate", assigned: false, expected: false },
  // ... all 100+ combinations
];

describe("PermissionEngine", () => {
  EXPECTED_PERMISSIONS.forEach(({ role, resource, action, expected, ...ctx }) => {
    it(`${role} ${action} ${resource} = ${expected}`, () => { ... });
  });
});
```

---

### Task 5.3: Test API Route Handlers
**Priority**: 🟠 HIGH | **Effort**: 2 days | **Dependencies**: None

**Files to create** (one per route group):
- `web/app/api/events/__tests__/events-routes.test.ts`
- `web/app/api/events/[id]/fund/__tests__/fund-route.test.ts`
- `web/app/api/events/[id]/disburse/__tests__/disburse-route.test.ts`
- `web/app/api/wallets/__tests__/wallet-routes.test.ts`
- `web/app/api/disputes/__tests__/dispute-routes.test.ts`

**Test each route for**:
- Auth required (401 without token)
- Schema validation (422 with invalid body)
- Permission check (403 for unauthorized role)
- Happy path (200/201 with valid input)
- Error cases (404, 409, etc.)
- Idempotency header required (for financial routes)

---

### Task 5.4: Test Middleware Pipeline
**Priority**: 🟡 MEDIUM | **Effort**: 1 day | **Dependencies**: None

**File**: `web/middleware.test.ts` (expand existing)

**Test scenarios**:
- Public paths pass without auth
- Protected paths redirect to login (page routes)
- Protected API paths return 401 JSON
- Rate limiting: exceed limit → 429 with Retry-After
- CSP nonce is unique per request
- Security headers present on all responses
- Request ID propagated

---

### Task 5.5: Test KMS Service
**Priority**: 🟡 MEDIUM | **Effort**: 4 hours | **Dependencies**: Task 1.2

**File to create**: `web/lib/services/__tests__/kms.test.ts`

```typescript
describe("KMS Service", () => {
  it("encryptSecret + decryptSecret round-trip (local)", async () => {
    const secret = "SCZANGBA5YHTNYVVV3C7CAZMCLFJLQCFKV3L6GBO7KN2VB5CYC3ZA6V";
    const encrypted = await encryptSecret(secret);
    expect(encrypted).toMatch(/^aes:/);
    const decrypted = await decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("rejects production use without KMS_KEY_ARN", () => { ... });
  it("encrypts with different IV each time (no determinism)", () => { ... });
});
```

---

### Task 5.6: E2E Tests — Complete User Journeys
**Priority**: 🟡 MEDIUM | **Effort**: 2 days | **Dependencies**: Phase 2 complete

**Files to create/update**:
- `web/e2e/signup-to-workspace.spec.ts` — Guest → Signup → Create Workspace
- `web/e2e/organizer-full-lifecycle.spec.ts` — Create event → Publish → Fund → Disburse
- `web/e2e/participant-full-lifecycle.spec.ts` — Join → Team → Submit → Win
- `web/e2e/accessibility.spec.ts` — Run axe-core on all pages

**Wire accessibility testing** (already installed):
```typescript
import AxeBuilder from "@axe-core/playwright";

test("dashboard has no accessibility violations", async ({ page }) => {
  await page.goto("/dashboard");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

---

## Phase 6: Production Infrastructure (Weeks 7-8)
*CI/CD, monitoring, observability, deployment configuration.*


### Task 6.1: CI/CD Pipeline
**Priority**: 🟠 HIGH | **Effort**: 4 hours | **Dependencies**: None

**File to create**: `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: web
      - run: npm run typecheck
        working-directory: web
      - run: npm run lint
        working-directory: web
      - run: npm run format:check
        working-directory: web
      - run: npm run test
        working-directory: web
```

**Gate**: PRs cannot merge unless all checks pass.

---

### Task 6.2: Error Tracking (Sentry)
**Priority**: 🟠 HIGH | **Effort**: 2 hours | **Dependencies**: None

**Install**: `@sentry/nextjs`

**Files to create**:
- `web/sentry.client.config.ts`
- `web/sentry.server.config.ts`
- `web/sentry.edge.config.ts`
- `web/next.config.ts` — Add Sentry webpack plugin

**Integration points**:
- `web/app/error.tsx` — Report to Sentry
- `web/lib/errors/handler.ts` — Capture 5xx errors
- Financial service catch blocks — Capture with context

---

### Task 6.3: Structured Logging
**Priority**: 🟡 MEDIUM | **Effort**: 4 hours | **Dependencies**: None

**File to expand**: `web/lib/logger.ts`

**Change**: Replace `console.error` throughout codebase with structured logger:
```typescript
export const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => { ... },
  warn: (msg: string, ctx?: Record<string, unknown>) => { ... },
  error: (msg: string, ctx?: Record<string, unknown>) => { ... },
};
```

Format: JSON in production, human-readable in development.
Include: timestamp, level, message, requestId, userId (if available).

---

### Task 6.4: Vercel Deployment Configuration
**Priority**: 🟡 MEDIUM | **Effort**: 2 hours | **Dependencies**: None

**File to create**: `web/vercel.json`
```json
{
  "crons": [
    { "path": "/api/cron/reconcile", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/cleanup-idempotency", "schedule": "0 * * * *" }
  ]
}
```

**Environment variables checklist** (document in `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `KMS_KEY_ARN`
- `AWS_REGION`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- `STELLAR_NETWORK_MODE`
- `STELLAR_MAINNET_ENABLED`
- `SOROBAN_RPC_URL`
- `ESCROW_CONTRACT_ID`
- `CRON_SECRET`
- `SENTRY_DSN`

---

### Task 6.5: Health Check Enhancement
**Priority**: 🟡 MEDIUM | **Effort**: 2 hours | **Dependencies**: None

**File to modify**: `web/app/api/health/route.ts`

**Add readiness checks**:
```typescript
export async function GET() {
  const checks = {
    database: await checkSupabase(),
    stellar: await checkStellarHorizon(),
    redis: await checkUpstash(),
  };
  const healthy = Object.values(checks).every(c => c.ok);
  return Response.json({ status: healthy ? "ok" : "degraded", checks }, 
    { status: healthy ? 200 : 503 });
}
```

---

## Phase 7 (Bonus): Advanced Features (Weeks 8-10)
*Only after Phases 0-6 are complete and tested.*

### Task 7.1: Multi-Round Judging
- Implement JudgingRound1 → JudgingRound2 transition
- Add round configuration to event creation
- Allow different judge panels per round

### Task 7.2: Sponsor Dashboard
- Sponsor-specific dashboard page
- Milestone tracking UI
- Sponsorship contribution view
- Disbursement status per sponsor

### Task 7.3: Participant Prize View
- "My Prizes" page showing won amounts and payout status
- Link to Stellar explorer for confirmed transactions
- Wallet verification prompt if not verified

### Task 7.4: Claimable Balances for Held Winners
- When winner has no verified wallet, create Stellar claimable balance
- Store claimable balance ID in winners table
- Allow winners to claim after wallet verification

### Task 7.5: Email Digest System
- Cron job aggregates non-urgent notifications (hourly/daily)
- Builds digest email via Resend
- Respects per-category notification preferences

### Task 7.6: Audit Log Export
- `/api/audit/export` endpoint
- Supports CSV and JSON formats
- Filterable by date range, event, actor
- Paginated for large datasets

---

## Execution Order & Dependencies

```
Phase 0 (Week 1) — CRITICAL BLOCKERS
  ├── 0.1 Fix encryption ─────────────────┐
  ├── 0.2 Fix signing ◄──── depends on 0.1│
  ├── 0.3 Align state model               │ All independent
  ├── 0.4 Fix migration conflict           │ except 0.2→0.1
  ├── 0.5 Transaction boundaries ◄── 0.4   │
  └── 0.6 Signup page                      │
                                           │
Phase 1 (Week 2) — SECURITY                │
  ├── 1.1 Complete permissions   ◄── 0.3   │
  ├── 1.2 Remove legacy XOR     ◄── 0.1 ──┘
  ├── 1.3 Restrict RLS          ◄── 0.4
  └── 1.4 Optimistic concurrency

Phase 2 (Weeks 2-3) — UX  ┐
  ├── 2.1 Workspace creation│  Run in parallel
  ├── 2.2 Workspace mgmt   │  with Phase 1
  ├── 2.3 Notification inbox│
  ├── 2.4 Workspace switcher│
  ├── 2.5 Event sub-nav     │
  ├── 2.6 Loading/Error     │
  └── 2.7 Legal pages       ┘

Phase 3 (Weeks 3-4) — FINANCIAL
  ├── 3.1 Full event state machine ◄── 0.3
  ├── 3.2 Settlement service       ◄── 0.5
  ├── 3.3 Reconciliation cron
  ├── 3.4 Fix Soroban query
  ├── 3.5 Fee accounting           ◄── 0.2
  └── 3.6 Idempotency cleanup

Phase 4 (Weeks 4-5) — ARCHITECTURE
  ├── 4.1 Fitness tests
  ├── 4.2 Consolidate permissions  ◄── 1.1
  ├── 4.3 Wire event bus
  └── 4.4 Events domain migration  ◄── 3.1, 4.1

Phase 5 (Weeks 5-7) — TESTING
  ├── 5.1 Financial tests   ◄── Phase 0
  ├── 5.2 Permission tests  ◄── 1.1
  ├── 5.3 API route tests
  ├── 5.4 Middleware tests
  ├── 5.5 KMS tests          ◄── 1.2
  └── 5.6 E2E tests          ◄── Phase 2

Phase 6 (Weeks 7-8) — INFRASTRUCTURE
  ├── 6.1 CI/CD
  ├── 6.2 Error tracking
  ├── 6.3 Structured logging
  ├── 6.4 Vercel config
  └── 6.5 Health checks
```

---


## Definition of Done (Per Task)

Every task is considered complete when:
1. ✅ Code implemented and compiles (`npm run typecheck` passes)
2. ✅ Lint passes (`npm run lint`)
3. ✅ Tests written and passing (`npm run test`)
4. ✅ No regressions in existing tests
5. ✅ Acceptance criteria met (checked off above)
6. ✅ Code reviewed (self-review minimum; peer review for financial code)

---

## Risk Mitigation Strategies

| Risk | Mitigation |
|------|-----------|
| Breaking existing features during state model change | Feature-flag the new 16-state model; fallback to 5-state until UI is ready |
| Migration 000048 conflict on existing dev databases | Create a "squash" migration that handles both paths |
| Soroban contract not deployed on testnet | Keep Horizon-based path as primary; Soroban as optional enhancement |
| KMS not available in development | Local AES-256-GCM with required env var (no hardcoded default) |
| Rate limiting Redis unavailable | In-memory fallback already implemented (verify with test) |
| Stellar testnet downtime | Mock adapter for all tests; only E2E tests hit real testnet |

---

## Success Metrics

| Milestone | Target Date | Criteria |
|-----------|-------------|----------|
| Critical Blockers Fixed | End of Week 1 | All 6 Phase 0 tasks complete |
| Beta-Ready | End of Week 5 | Signup → Fund → Disburse works on testnet |
| Test Coverage Target | End of Week 7 | 70% overall, 90% financial |
| Production Deploy | End of Week 8 | Testnet deployment with monitoring |
| Mainnet Ready | End of Week 13 | Security audit passed, DR drill completed |

---

## How to Use This Plan

1. **Start with Phase 0** — Nothing else matters until these are fixed
2. **Phase 1 + Phase 2 in parallel** — Security engineer does Phase 1 while frontend does Phase 2
3. **Phase 3 after Phase 0** — Financial work depends on correct encryption and signing
4. **Phase 4 is refactoring** — Only after the system works correctly
5. **Phase 5 continuously** — Write tests as you implement (not just at the end)
6. **Phase 6 early** — Set up CI in Week 1 alongside Phase 0 for immediate feedback

**Each task is designed to be completable in a single focused session (2h to 3d).**
**Each task is independently testable and deployable.**
**No task requires the entire system to be rebuilt — all are incremental improvements.**
