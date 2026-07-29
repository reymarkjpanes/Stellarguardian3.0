# Design Document — Stellar Guardian Production Audit

## Overview

Stellar Guardian 3.0 is a production-grade, decentralised hackathon and event management
platform built on Next.js 16 (App Router), Supabase/PostgreSQL, and the Stellar/Soroban
blockchain. The platform orchestrates the complete lifecycle of competitive events — from
organiser creation through participant registration, team formation, project submission,
multi-round judging, prize allocation, and trustless on-chain escrow disbursement.

This design document covers **only the delta** between the current codebase state and the
fully production-ready system described in the requirements. Every existing file, pattern,
and convention is preserved; the document adds what is missing and resolves the eight
identified structural gaps.

### Scope of This Audit

| Domain | Status |
|---|---|
| 16-state event lifecycle (`lib/state-machine/event.ts`) | ✅ Complete |
| Escrow state machine (`lib/state-machine/escrow.ts`) | ✅ Complete |
| Dispute state machine (`lib/state-machine/dispute.ts`) | ✅ Complete |
| Evaluation domain model (`src/domains/judging/`) | ✅ Complete |
| Team service (`lib/services/team.ts`) | ✅ Complete |
| Audit service (`lib/services/audit.ts`) | ✅ Complete |
| Notification service (`lib/services/notification.ts`) | ✅ Complete |
| File validation service (`lib/services/file-validation.ts`) | ✅ Complete |
| Judging service layer (`lib/services/judging/`) | ❌ Gap 1 — empty directory |
| Application status (`event_members.status` column) | ❌ Gap 2 — column missing in DB types |
| `teams.locked` column | ❌ Gap 3 — not visible in database.types.ts |
| Solo participant auto-conversion | ❌ Gap 4 — no service implementation |
| Duplicate v1 route structure | ❌ Gap 5 — `web/src/app/api/v1/` vs `web/app/api/v1/` |
| File upload route integration | ❌ Gap 6 — service exists, route wiring unclear |
| Admin route RBAC enforcement | ❌ Gap 7 — layout exists, server-side check not confirmed |
| Notification preferences table | ❌ Gap 8 — referenced in service, table definition unclear |

---

## Architecture

The system follows the layered architecture already present in the codebase:

```
Browser / Stellar Wallet
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  Next.js 16 App Router (web/)                            │
│  ┌──────────────────┐   ┌──────────────────────────────┐ │
│  │  Pages / UI      │   │  API Routes / Server Actions │ │
│  │  (app/ RSC + CC) │   │  (app/api/**)                │ │
│  └──────────────────┘   └──────────────────────────────┘ │
│          │                        │                       │
│          └──────────┬─────────────┘                       │
│                     ▼                                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Auth Layer  (lib/auth/permissions.ts + authorize.ts)│ │
│  │  requirePermission / requireEventRole / mfa-guard    │ │
│  └──────────────────────────────────────────────────────┘ │
│                     │                                     │
│  ┌──────────────────▼──────────────────────────────────┐  │
│  │  Application / Service Layer                        │  │
│  │  lib/services/*  lib/application/event.service.ts   │  │
│  │  lib/engines/workflow/  lib/engines/business-rules/ │  │
│  └──────────────────────────────────────────────────────┘ │
│                     │                                     │
│  ┌──────────────────▼──────────────────────────────────┐  │
│  │  Domain Layer                                       │  │
│  │  lib/state-machine/{event,escrow,dispute}.ts        │  │
│  │  src/domains/judging/ (EvaluationAggregate + SM)    │  │
│  └──────────────────────────────────────────────────────┘ │
│                     │                                     │
│  ┌──────────────────▼──────────────────────────────────┐  │
│  │  Infrastructure Layer                               │  │
│  │  lib/repositories/*  lib/supabase/*                 │  │
│  │  lib/stellar/*  lib/blockchain/*                    │  │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
       │                              │
       ▼                              ▼
  Supabase/PostgreSQL         Stellar/Soroban (testnet/mainnet)
  (DB + Auth + RLS + Realtime) (Escrow smart contract)
```

### Layering Rules (preserving existing conventions)

- **API routes** call `requirePermission`/`requireEventRole` at the top, then delegate to a service.
- **Services** (`lib/services/*`) own all business logic, call state machines for transitions, write audit records, and emit notifications.
- **State machines** (`lib/state-machine/*`) are pure TypeScript — no I/O. They validate requested transitions and return `TransitionResult`.
- **Repositories** (`lib/repositories/*`) are the only layer that touches the Supabase client directly (non-service read paths may use the Supabase client from `lib/supabase/server.ts`).
- **Domain aggregates** (`src/domains/*`) enforce invariants on complex objects before persistence.

---

## Components and Interfaces

### Existing Components (referenced, not changed)

| Component | Path | Role |
|---|---|---|
| `canEventTransition` | `lib/state-machine/event.ts` | Pure event lifecycle graph + preconditions |
| `validEventOutboundStates` | `lib/state-machine/event.ts` | Valid-outbound helper |
| `canEscrowTransition` | `lib/state-machine/escrow.ts` | Pure escrow lifecycle graph |
| `canDisputeTransition` | `lib/state-machine/dispute.ts` | Pure dispute lifecycle graph |
| `EvaluationStateMachine` | `src/domains/judging/domain/EvaluationStateMachine.ts` | Evaluation state transitions |
| `EvaluationAggregate` | `src/domains/judging/domain/EvaluationAggregate.ts` | Evaluation invariant enforcement |
| `EventWorkflowEngine` | `lib/engines/workflow/event-workflow.ts` | Business-rules wiring to event graph |
| `EventBusinessRules` | `lib/engines/business-rules/event-rules.ts` | Individual rule functions |
| `requirePermission` | `lib/auth/permissions.ts` | RBAC helper (workspace + event) |
| `requireEventRole` | `lib/auth/permissions.ts` | Event-scoped role check |
| `requireWorkspaceRole` | `lib/auth/permissions.ts` | Workspace-scoped role check |
| `writeAuditRecord` | `lib/services/audit.ts` | Append-only audit log writer |
| `createNotification` | `lib/services/notification.ts` | In-app + email notification dispatch |
| `validateFile` | `lib/services/file-validation.ts` | Pure file validation (MIME + size) |
| `createTeam` / `joinTeam` / `leaveTeam` | `lib/services/team.ts` | Team formation service |
| `createSubmission` / `submitSubmission` | `lib/services/submission.ts` | Submission lifecycle service |
| `createEvaluation` | `lib/services/evaluation.ts` | Evaluation COI check + creation |

### New Components (gaps to fill)

#### Gap 1 — `lib/services/judging/judging.service.ts`

The `lib/services/judging/` directory exists but contains only a `__tests__/` folder. A judging service is needed to bridge `EvaluationAggregate` to the database, wire scoring, and implement auto-save.

```typescript
// lib/services/judging/judging.service.ts
export interface SaveDraftParams {
  evaluationId: string;
  judgeId: string;
  scores: EvaluationScores;
  draftNotes?: string;
}

export interface SubmitEvaluationParams {
  evaluationId: string;
  judgeId: string;
  scores: EvaluationScores;
  participantFeedback?: string;
  organizerNotes?: string;
}

export async function saveDraftEvaluation(params: SaveDraftParams): Promise<void>
export async function submitEvaluation(params: SubmitEvaluationParams): Promise<{ totalScore: number }>
export async function declareConflict(evaluationId: string, judgeId: string, reason?: string): Promise<void>
export async function finalizeEvaluations(eventId: string, organizerId: string): Promise<number>
export async function computeWeightedScore(scores: EvaluationScores, criteria: EvaluationCriteria[]): Promise<number>
```

`computeWeightedScore` is a pure function: `sum(score_i * weight_i) / sum(weight_i)` (normalised) or `sum(score_i * weight_i)` (raw weighted), matching the event's `judging_strategy`.

#### Gap 2 — `event_members.status` Migration

The `event_members` table row type in `database.types.ts` does not expose a `status` column. Requirements 4.3–4.7 require `Pending | Approved | Rejected | Withdrawn` application status tracking.

New migration adds:
```sql
ALTER TABLE event_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL
    DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Withdrawn'));
```

`database.types.ts` must be regenerated after migration.

#### Gap 3 — `teams.locked` Migration

The `teams` table row type does not expose a `locked` column. Requirement 5.11 requires `locked = true` for all teams when the event enters `TeamFormationLocked`.

New migration adds:
```sql
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;
```

#### Gap 4 — `lib/services/team.ts`: `autoConvertSoloParticipants`

Requirement 5.12 requires solo participants to be auto-converted to single-member Team Captains before the `TeamFormationLocked` transition. No implementation exists.

```typescript
// Append to lib/services/team.ts
export async function autoConvertSoloParticipants(params: {
  eventId: string;
  actorId: string;
}): Promise<{ converted: number }>
```

Called by the event transition handler for `RegistrationClosed → TeamFormationLocked` before the precondition check for `allParticipantsAssigned`.

#### Gap 5 — Route Consolidation Plan

Two parallel v1 route trees exist:
- `web/app/api/v1/` — canonical Next.js App Router location (has `route.ts`, `events/`, `teams/`)
- `web/src/app/api/v1/` — orphan directory (has `events/`, `join-requests/`, `team-invitations/`)

The `web/src/` tree is not a valid Next.js App Router location and its routes are unreachable. Resolution:

1. Move handlers from `web/src/app/api/v1/events/[eventId]/members/route.ts` → `web/app/api/v1/events/[eventId]/members/route.ts`.
2. Move handlers from `web/src/app/api/v1/join-requests/` → `web/app/api/v1/join-requests/`.
3. Move handlers from `web/src/app/api/v1/team-invitations/` → `web/app/api/v1/team-invitations/`.
4. Delete `web/src/app/` entirely once all routes are migrated.

#### Gap 6 — File Upload Route Integration

`lib/services/file-validation.ts` implements `validateFile` and `scanForMalware` but route integration is unconfirmed. The upload API route at `app/api/upload/route.ts` must:

1. Read the file buffer from the multipart request.
2. Call `validateFile(filename, declaredMimeType, sizeBytes, buffer, event.file_policy.allowed_types)`.
3. Call `scanForMalware(buffer, filename)`.
4. On any violation, return HTTP 422 with the structured error envelope.
5. On clean pass, upload to Supabase Storage and return the storage path.

No new service is needed — the integration is a route-level wiring task.

#### Gap 7 — Admin Route RBAC Enforcement

`app/(app)/admin/layout.tsx` exists but server-side role enforcement has not been confirmed. The layout must call:

```typescript
// app/(app)/admin/layout.tsx
import { requirePermission } from '@/lib/auth/permissions';
// ...
const { user } = await requirePermission('platform', 'workspace', 'read');
// Must confirm user has PlatformAdmin role
```

Since `requirePermission` maps to workspace roles, admin layout should use a dedicated `requirePlatformAdmin()` helper that checks the `workspace_members` `PlatformAdmin` role or a dedicated `is_admin` flag on the `users` table.

```typescript
// lib/auth/permissions.ts — add:
export async function requirePlatformAdmin(): Promise<{ user: User }>
```

#### Gap 8 — `notification_preferences` Table

The notification service references `notification_preferences` table columns `email_enabled` and `category`, but this table is not visible in `database.types.ts`. Migration required:

```sql
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category)
);
```

---

## Data Models

### Existing Tables (key shapes confirmed from `database.types.ts`)

**`events`** — The central entity. Key fields used in transitions:
- `state: event_lifecycle_state` — 16-state enum
- `version: number` — optimistic concurrency
- `file_policy: Json` — `{ allowed_types: string[], max_size_bytes: number }`
- `resubmission_policy: Json` — `{ enabled: boolean }`
- `review_window_hours: number`
- `prize_pool_target: number | null`
- `registration_deadline: string | null`

**`event_members`** — Participant/Judge/Mentor membership.
- `role: string` — `Participant | Judge | Mentor | Organizer`
- `team_status: member_team_status` — `unassigned | in_team | ...`
- ⚠️ **Missing**: `status TEXT` column for application state (`Pending | Approved | Rejected | Withdrawn`)

**`teams`** — Team records with optimistic concurrency.
- `captain_id: string`
- `version: number`
- ⚠️ **Missing**: `locked BOOLEAN` column

**`evaluations`** — Judge evaluations with EvaluationStateMachine states.
- `status: evaluation_lifecycle_state` — `Assigned | Draft | Submitted | Flagged | Finalized`
- `scores: Json` — criterion score map
- `total_score: number`
- `conflict_of_interest: boolean`
- `version: number`

**`escrow_accounts`** — On-chain escrow record.
- `status: escrow_status` — `PendingFunding | PartiallyFunded | FullyFunded | Locked | PendingRelease | Released | Cancelled | Refunded | Failed`
- `available_balance: number`, `expected_balance: number`
- `version: number`

**`disputes`** — Dispute records.
- `state: string` — `Open | UnderReview | Upheld | Dismissed | Withdrawn`
- `version: number`

**`prize_allocation_batches`** — Locked prize distribution records.
- `status` — `Draft | Locked | Released`

**`audit_records`** — Append-only financial audit trail.
**`audit_logs`** — General platform audit log.
**`domain_events`** — Outbox pattern event table.
**`inbox_events`** — Inbound event processing with retry/status tracking.
**`idempotency_keys`** — Deduplication for financial writes.

### New Tables (migrations required)

```sql
-- Gap 2: Application status on event_members
ALTER TABLE event_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL
    DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Withdrawn'));

-- Gap 3: Team formation lock flag
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

-- Gap 8: Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category)
);
```

### Data Flow — Event Lifecycle Transition

```
API Route (app/api/events/[id]/transition/route.ts)
  │
  ├─ requirePermission(eventId, 'event', 'transition')
  │
  ├─ Read event + build EventTransitionContext
  │
  ├─ canEventTransition(from, to, ctx)  ◄── lib/state-machine/event.ts
  │    └─ returns TransitionResult
  │
  ├─ [if ok] supabase.update({ state: to, version: event.version + 1 })
  │    └─ optimistic check: .eq('version', event.version) → 409 on mismatch
  │
  ├─ Side effects (parallel):
  │    ├─ writeAuditRecord({ action: 'event.state_transition', ... })
  │    ├─ publisher.publish('EventStateChanged', { from, to, eventId })
  │    └─ [conditional] autoConvertSoloParticipants / lockTeams / etc.
  │
  └─ Return 200 { state: to, validOutbound: [...] }
```

### Data Flow — Prize Allocation Sum Validation

```
Prize Allocation Service
  │
  ├─ Load prize_allocation_batches where event_id = X
  ├─ sum all prize_allocations.amount
  ├─ diff = |sum - prize_pool_target|
  ├─ if diff > 0.0000001 XLM (1 stroop) → throw ValidationError
  └─ else → batch.status = 'Locked'
```

---

## Gap Analysis

This section maps each identified gap to its specific fix.

| Gap | Description | Fix | Files Affected |
|---|---|---|---|
| 1 | `lib/services/judging/` directory is empty | Create `judging.service.ts` implementing saveDraft, submit, declareConflict, finalizeEvaluations, computeWeightedScore | `lib/services/judging/judging.service.ts` (new) |
| 2 | `event_members` lacks `status` column | Add migration `ALTER TABLE event_members ADD COLUMN status TEXT DEFAULT 'Pending'`; regenerate types | `supabase/migrations/*.sql`, `database.types.ts` |
| 3 | `teams.locked` column missing from types | Add migration `ALTER TABLE teams ADD COLUMN locked BOOLEAN DEFAULT false`; regenerate types | `supabase/migrations/*.sql`, `database.types.ts` |
| 4 | No solo-participant auto-conversion | Add `autoConvertSoloParticipants()` to `lib/services/team.ts`; call from transition handler before `TeamFormationLocked` | `lib/services/team.ts` |
| 5 | Duplicate `web/src/app/api/v1/` routes unreachable | Move all handlers to `web/app/api/v1/`; delete `web/src/app/` | All `web/src/app/api/v1/**` route files |
| 6 | File upload route not wired to validation service | Update `app/api/upload/route.ts` to call `validateFile` + `scanForMalware` before Supabase Storage upload | `app/api/upload/route.ts` |
| 7 | Admin layout lacks server-side RBAC check | Add `requirePlatformAdmin()` helper; call it at the top of `app/(app)/admin/layout.tsx` | `lib/auth/permissions.ts`, `app/(app)/admin/layout.tsx` |
| 8 | `notification_preferences` table not migrated | Add migration for the table; regenerate types | `supabase/migrations/*.sql`, `database.types.ts` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The existing codebase uses `fast-check` with `vitest`. Properties below are written in terms of the existing pure functions and must be implemented as property-based tests in the `lib/state-machine/__tests__/` and `lib/services/__tests__/` directories with a minimum of 100 iterations each.

---

### Property 1: Event State Machine — Valid Transitions Only

*For any* valid event state and any target state that does not exist in the event transition graph, `canEventTransition` shall return `ok: false` with a non-empty `unmetPreconditions` array referencing the missing edge.

*Conversely*, for any edge (from, to) that does exist in the graph, when all preconditions in `EventTransitionContext` are satisfied, `canEventTransition` shall return `ok: true`.

**Validates: Requirements 10.2, 16.5**

---

### Property 2: Event State Machine — Precondition Monotonicity

*For any* context `ctx` where `canEventTransition(from, to, ctx).ok === true`, enriching `ctx` with additional truthy values (more judges, `hasRegistrationDeadline: true`, etc.) shall not cause the result to flip to `ok: false`. Adding more information never breaks a satisfied precondition.

**Validates: Requirements 10.2, 6.1, 6.2, 6.3, 6.4**

---

### Property 3: Escrow State Machine — Round-Trip Funding

*For any* `fundingTarget > 0` and `cumulativeConfirmedDeposits >= fundingTarget`, the escrow state machine shall permit the `PendingFunding → FullyFunded` transition, and the resulting context shall satisfy the `FullyFunded → Locked` precondition when `reconciled === true`.

**Validates: Requirements 9.2, 9.3**

---

### Property 4: Escrow Balance Tolerance — 1 Stroop

*For any* `balance` and `target`, the "fully funded" predicate shall return `true` if and only if `Math.abs(balance - target) <= 0.0000001`. This pure computation must be exact for all floating-point-representable XLM amounts up to 10^9 XLM.

**Validates: Requirements 8.8, 9.3**

---

### Property 5: Prize Allocation Sum Invariant

*For any* `prize_pool_target T` and set of `prize_allocations` records in an approved batch, the allocation is valid if and only if `|sum(amount_i) - T| <= 0.0000001`. Any batch whose allocations do not satisfy this invariant shall be rejected at write time with HTTP 422.

**Validates: Requirements 8.8**

---

### Property 6: One-Team-Per-Participant Invariant

*For any* event and any user who already has a `team_members` record for that event, calling `joinTeam` or `createTeam` with the same `(userId, eventId)` pair shall throw a `ConflictError` — regardless of which team they attempt to join or how the request is ordered.

**Validates: Requirements 5.2**

---

### Property 7: Team Size Max Enforcement

*For any* team of size `N = team_size_max`, calling `joinTeam` for any additional user shall throw a `BadRequestError`. This must hold for all values of `team_size_max ∈ [1, 50]`.

**Validates: Requirements 5.3**

---

### Property 8: Captain Transfer — Earliest-Joined Member

*For any* team with `N ≥ 2` members where each member has a distinct `joined_at` timestamp, when the current captain calls `leaveTeam`, the new `teams.captain_id` must equal the `user_id` of the member with the minimum `joined_at` among the remaining members.

**Validates: Requirements 5.9**

---

### Property 9: Solo Participant Auto-Conversion Completeness

*For any* event where `team_size_min = 1`, after `autoConvertSoloParticipants` runs, every participant whose `event_members.team_status = 'unassigned'` before the call must have `team_status = 'in_team'` after the call, and a corresponding `teams` record where `captain_id = participant.user_id` must exist.

**Validates: Requirements 5.12**

---

### Property 10: Team Formation Lock — All Teams Locked

*For any* event transitioning to `TeamFormationLocked`, for every `teams` record in that event, `locked = true` must hold after the transition completes. The number of locked teams must equal the total number of active (non-deleted) teams.

**Validates: Requirements 5.11**

---

### Property 11: Evaluation Weighted Score Computation

*For any* non-empty list of `CriterionScore` records where each `score ∈ [0, maxScore]` and each `weight > 0`, `computeWeightedScore(scores, criteria)` shall return a value equal to `sum(score_i * weight_i) / sum(weight_i)` (normalised) within floating-point precision tolerance (`1e-9`).

**Validates: Requirements 7.4**

---

### Property 12: Rubric Score Bounds Validation

*For any* evaluation submission where any criterion score exceeds `criterion.max_score` or is below `0`, the evaluation service shall reject the submission with a `ValidationError`. For any evaluation where all scores are within bounds, validation shall succeed.

**Validates: Requirements 7.7**

---

### Property 13: Evaluation COI — Judge-Team Membership

*For any* `(judgeId, submissionId)` pair where the judge is a member of the team that authored the submission, `createEvaluation` shall throw a `ForbiddenError` with code `CONFLICT_OF_INTEREST`. For any pair where the judge is not on the team, no COI error shall be thrown.

**Validates: Requirements 7.6**

---

### Property 14: Application Duplicate Prevention

*For any* `(userId, eventId)` pair where an `event_members` record already exists, submitting a second application shall return HTTP 409. This must hold regardless of the current state of the existing record.

**Validates: Requirements 4.2**

---

### Property 15: File Validation — MIME Type Policy

*For any* file whose detected MIME type (via magic-byte inspection) is not in the event's `file_policy.allowed_types` set, `validateFile` shall return a `FileValidationResult` where `valid = false` and `violations` contains at least one string mentioning the disallowed type. For any file whose detected type is in the allowed set, no type violation shall appear.

**Validates: Requirements 6.10**

---

### Property 16: Optimistic Concurrency — Version Conflict Detection

*For any* versioned entity (events, teams, evaluations, escrow_accounts) at database version `V`, two concurrent update operations both presenting `version = V` must result in exactly one success (`200 OK`) and one conflict (`409` with `conflictVersion`). The winning write must increment the version to `V + 1`.

**Validates: Requirements 11.8, 16.9**

---

### Property 17: Event Discovery Filter Correctness

*For any* filter predicate over `(category, format, network_mode, tags)` applied to the discovery endpoint, every returned event record must satisfy that predicate. No event that fails any active filter shall appear in the results.

**Validates: Requirements 3.2**

---

### Property 18: Dispute State Machine — Terminal State Immutability

*For any* dispute in a terminal state (`Upheld`, `Dismissed`, `Withdrawn`), calling `canDisputeTransition` with any target state shall return `ok: false` and `validOutbound: []`. Terminal disputes can never transition.

**Validates: Requirements 8.6**

---

### Property 19: Audit Record — Every State Transition Is Logged

*For any* successful event, evaluation, or escrow state transition, an `audit_records` row must exist with `action` matching the transition type, `actor_id` set to the triggering user, and `resource_id` set to the entity's UUID. No transition succeeds without a corresponding audit record.

**Validates: Requirements 4.8, 6.9, 7.11**

---

### Property 20: Structured Error Envelope on Validation Failure

*For any* API request that fails Zod schema validation, the response body must conform to `{ code: string, message: string, field?: string, details?: unknown }`. No raw stack traces, internal error codes, or empty bodies shall be returned for 422 responses.

**Validates: Requirements 11.5, 16.2**

---

## Error Handling

### Error Classes (existing — `lib/errors/errors.ts`)

The codebase already defines a typed error hierarchy. All services and route handlers must use it consistently:

| Error Class | HTTP Status | Use Case |
|---|---|---|
| `NotFoundError` | 404 | Resource not found by ID |
| `ConflictError` | 409 | Duplicate resource, version conflict |
| `ForbiddenError` | 403 | RBAC denial, IDOR prevention |
| `AuthError` (UNAUTHENTICATED) | 401 | No session |
| `AuthError` (FORBIDDEN) | 403 | Insufficient role |
| `BadRequestError` | 400 | Invalid state for operation |
| `ValidationError` | 422 | Zod schema or business rule violation |
| `BusinessRuleError` | 422 | Domain rule violation with structured details |

### Error Response Envelope

All API error responses must use `lib/errors/responses.ts` to build:

```typescript
{
  code: string;       // Machine-readable error code, e.g. "TRANSITION_INVALID"
  message: string;    // Human-readable description
  field?: string;     // Field name for validation errors
  details?: unknown;  // Optional structured context (unmetPreconditions, conflictVersion, etc.)
}
```

### State Transition Error Pattern

When `canEventTransition`, `canEscrowTransition`, or `canDisputeTransition` returns `ok: false`, route handlers return:

```typescript
return NextResponse.json(
  {
    code: 'TRANSITION_INVALID',
    message: 'The requested state transition is not permitted.',
    details: {
      currentState: from,
      requestedState: to,
      validOutbound: result.validOutbound,
      unmetPreconditions: result.unmetPreconditions,
    }
  },
  { status: 422 }
);
```

### Concurrency Conflict Pattern

When an optimistic lock check fails (Supabase `.eq('version', V)` returns 0 rows updated):

```typescript
return NextResponse.json(
  {
    code: 'CONCURRENT_MODIFICATION',
    message: 'Another update occurred concurrently. Please reload and retry.',
    details: { conflictVersion: current.version }
  },
  { status: 409 }
);
```

### Audit Write Failures

`writeAuditRecord` logs errors but does not throw — audit failures must never block the primary operation. This is the existing pattern and must be preserved.

---

## Testing Strategy

### Dual Testing Approach

The project uses `vitest` for unit and property-based tests, and `playwright` for end-to-end tests. Both layers are required.

### Property-Based Testing (fast-check)

**Library**: `fast-check` (already installed, used in `lib/state-machine/event.test.ts`)  
**Minimum iterations**: 100 per property (fast-check default is 100; set `numRuns: 100` explicitly)  
**Tag format**: Each test file must include a comment referencing the design property:
```typescript
// Feature: stellar-guardian-production-audit, Property N: <property_text>
```

#### Property Test Locations and Targets

| Property | File | Existing / New |
|---|---|---|
| 1, 2 — Event SM valid transitions + monotonicity | `lib/state-machine/event.test.ts` | Extend existing |
| 3 — Escrow SM round-trip funding | `lib/state-machine/__tests__/escrow.property.test.ts` | New |
| 4 — Escrow balance 1-stroop tolerance | `lib/state-machine/__tests__/escrow.property.test.ts` | New |
| 5 — Prize allocation sum invariant | `lib/services/__tests__/prize-allocation.property.test.ts` | New |
| 6 — One-team-per-participant | `lib/services/__tests__/team.property.test.ts` | New |
| 7 — Team size max enforcement | `lib/services/__tests__/team.property.test.ts` | New |
| 8 — Captain transfer earliest-joined | `lib/services/__tests__/team.property.test.ts` | New |
| 9 — Solo auto-conversion completeness | `lib/services/__tests__/team.property.test.ts` | New |
| 10 — Team lock all-locked invariant | `lib/services/__tests__/team.property.test.ts` | New |
| 11 — Evaluation weighted score | `lib/services/judging/__tests__/judging.property.test.ts` | New |
| 12 — Rubric score bounds | `lib/services/judging/__tests__/judging.property.test.ts` | New |
| 13 — Evaluation COI judge-team | `lib/services/__tests__/evaluation.property.test.ts` | New |
| 14 — Application duplicate prevention | `lib/services/__tests__/application.property.test.ts` | New |
| 15 — File validation MIME policy | `lib/services/file-validation.test.ts` | Extend existing |
| 16 — Optimistic concurrency version conflict | `lib/services/__tests__/concurrency.property.test.ts` | New |
| 17 — Discovery filter correctness | `lib/services/__tests__/discovery.property.test.ts` | New |
| 18 — Dispute SM terminal immutability | `lib/state-machine/__tests__/dispute.property.test.ts` | New |
| 19 — Audit record per state transition | `lib/services/__tests__/audit.property.test.ts` | New |
| 20 — Structured error envelope | `lib/errors/__tests__/responses.property.test.ts` | New |

#### Representative fast-check Pattern

```typescript
// Feature: stellar-guardian-production-audit, Property 8: captain transfer earliest-joined
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Property 8: Captain transfer to earliest-joined member', () => {
  it('new captain is always the member with minimum joined_at', () => {
    fc.assert(
      fc.property(
        // Generate a team of 2+ members, each with distinct joined_at
        fc.array(fc.record({
          user_id: fc.uuid(),
          joined_at: fc.date({ min: new Date('2020-01-01') }),
        }), { minLength: 2, maxLength: 10 }),
        (members) => {
          // Ensure unique joined_at values for deterministic ordering
          const unique = members.filter(
            (m, i, arr) => arr.findIndex(x => x.joined_at.getTime() === m.joined_at.getTime()) === i
          );
          if (unique.length < 2) return true; // skip degenerate
          const captain = unique[0];
          const remaining = unique.slice(1);
          const expectedNewCaptain = remaining.reduce((min, m) =>
            m.joined_at < min.joined_at ? m : min
          );
          // Assert: earliest-joined remaining member becomes captain
          expect(expectedNewCaptain.joined_at).toBeLessThanOrEqual(
            ...remaining.map(m => m.joined_at)
          );
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Tests

Unit tests should cover:
- Specific examples for each CRUD operation (create, read, update, delete)
- All state transition examples already in `lib/state-machine/event.test.ts`
- Error condition examples (missing fields, wrong role, expired deadlines)
- Integration between components at the service layer

Unit tests must **not** duplicate what property tests already verify universally — avoid testing the same logic with both a property test and a hand-picked example unless the example tests a specific edge case.

### Integration Tests

For AWS-like external service interactions (Stellar Horizon API, Supabase Realtime, Resend email):

- Use mock adapters (`src/domains/escrow/adapters/MockStellarAdapter.ts`)
- Run 1–3 representative examples, not randomised suites
- Focus on verifying the "wiring" (correct function calls, correct parameters)

### End-to-End Tests (Playwright)

Existing E2E test files:
- `tests/e2e/judging/judge-workspace.spec.ts`
- `tests/e2e/submissions/participant-journey.spec.ts`

Additional E2E coverage needed for:
- Admin dashboard access control (`/admin` requires PlatformAdmin)
- Full event creation → escrow funding → prize disbursement happy path
- Dispute filing → resolution → PrizeApproved transition

### CI Requirements (Req 16.5, 16.6)

All property tests must pass in CI (`vitest run` — not watch mode). The `fast-check` seed must be deterministic in CI via `fc.configureGlobal({ seed: process.env.CI ? 42 : Date.now() })`.
