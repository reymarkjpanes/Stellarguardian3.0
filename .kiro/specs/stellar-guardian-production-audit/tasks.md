# Implementation Plan: Stellar Guardian Production Audit

## Overview

This implementation plan closes the eight structural gaps identified in the Stellar Guardian 3.0 production audit and brings the platform to full production readiness. Tasks are ordered by dependency: database migrations first (Tasks 1–3), service-layer implementations second (Tasks 4–5), route and auth fixes third (Tasks 6–8), production hardening fourth (Tasks 9–13), and property-based tests last (Tasks 14–26). All 20 correctness properties are covered by dedicated fast-check + vitest tests with a minimum of 100 iterations each.

## Tasks

- [ ] 1. Add `event_members.status` column migration (Gap 2)
  - Create `supabase/migrations/<timestamp>_add_event_members_status.sql` with an idempotent `ALTER TABLE event_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','Withdrawn'))` statement
  - Verify the migration is idempotent (running it twice produces no error)
  - Regenerate `database.types.ts` so `event_members` Row type exposes `status: string`
  - **Satisfies:** Requirements 4.3, 4.4, 4.5, 4.7, 16.8

- [ ] 2. Add `teams.locked` column migration (Gap 3)
  - Create `supabase/migrations/<timestamp>_add_teams_locked.sql` with an idempotent `ALTER TABLE teams ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false` statement
  - Verify the migration is idempotent
  - Regenerate `database.types.ts` so `teams` Row type exposes `locked: boolean`
  - **Satisfies:** Requirements 5.11, 16.8

- [ ] 3. Add `notification_preferences` table migration (Gap 8)
  - Create `supabase/migrations/<timestamp>_create_notification_preferences.sql` with an idempotent `CREATE TABLE IF NOT EXISTS notification_preferences (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, category TEXT NOT NULL, email_enabled BOOLEAN NOT NULL DEFAULT true, in_app_enabled BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id, category))` statement
  - Verify the migration is idempotent
  - Regenerate `database.types.ts` so `notification_preferences` Row type is fully typed
  - **Satisfies:** Requirements 15.1, 15.6, 15.7, 16.8

- [ ] 4. Create judging service (Gap 1)
  - Create `lib/services/judging/judging.service.ts` exporting `SaveDraftParams`, `SubmitEvaluationParams`, `EvaluationScores`, `EvaluationCriteria` interfaces
  - Implement `saveDraftEvaluation(params: SaveDraftParams): Promise<void>` — transitions Evaluation to `Draft` via `EvaluationStateMachine`, persists scores, calls `writeAuditRecord`, uses optimistic locking on `version` column
  - Implement `submitEvaluation(params: SubmitEvaluationParams): Promise<{ totalScore: number }>` — validates all scores within `[0, criterion.max_score]`, transitions to `Submitted`, persists `total_score`, emits domain event, writes audit record; returns 409 if a `Submitted` evaluation already exists for the same `(judgeId, submissionId)` pair
  - Implement `declareConflict(evaluationId: string, judgeId: string, reason?: string): Promise<void>` — transitions Evaluation to `Flagged`, creates notification for Organiser, writes audit record
  - Implement `finalizeEvaluations(eventId: string, organizerId: string): Promise<number>` — transitions all `Submitted` evaluations for the event to `Finalized`, returns count, writes audit record
  - Implement `computeWeightedScore(scores: EvaluationScores, criteria: EvaluationCriteria[]): Promise<number>` as a pure function: `sum(score_i * weight_i) / sum(weight_i)` for normalised strategy, `sum(score_i * weight_i)` for raw strategy
  - Write unit tests in `lib/services/judging/__tests__/judging.service.test.ts` covering save-draft transitions, submit with valid scores, submit with out-of-bounds score returning `ValidationError`, `declareConflict` setting `Flagged`, `finalizeEvaluations` count, and duplicate submission returning `ConflictError`
  - **Satisfies:** Requirements 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11, 11.1

- [ ] 5. Implement `autoConvertSoloParticipants` in team service (Gap 4)
  - Append `autoConvertSoloParticipants(params: { eventId: string; actorId: string }): Promise<{ converted: number }>` to `lib/services/team.ts`; query all `event_members` where `event_id = eventId`, `role = 'Participant'`, `team_status = 'unassigned'`; for each, create a `teams` record with `captain_id = participant.user_id`, add a `team_members` entry, update `event_members.team_status` to `'in_team'`, and write an audit record per conversion
  - Wire `autoConvertSoloParticipants` into the event transition handler for `RegistrationClosed → TeamFormationLocked` (in `lib/engines/workflow/event-workflow.ts` or the relevant route handler) so it runs before the `allParticipantsAssigned` precondition check
  - After auto-conversion, set `locked = true` on all `teams` records for the event as part of the `TeamFormationLocked` side-effects
  - Write unit tests: unassigned participant is converted to captain, already-assigned participant is not re-converted, `converted` count matches previously-unassigned count
  - **Satisfies:** Requirements 5.11, 5.12

- [ ] 6. Consolidate duplicate v1 route tree (Gap 5)
  - Move `web/src/app/api/v1/events/[eventId]/members/route.ts` handler into `web/app/api/v1/events/[eventId]/members/route.ts` (create the directory if needed)
  - Move all handlers under `web/src/app/api/v1/join-requests/` to `web/app/api/v1/join-requests/` preserving subdirectory structure
  - Move all handlers under `web/src/app/api/v1/team-invitations/` to `web/app/api/v1/team-invitations/` preserving subdirectory structure
  - Fix any broken `@/` alias imports in the moved files
  - Delete `web/src/app/` entirely once all routes are confirmed migrated
  - Run ESLint to confirm zero import errors after deletion
  - **Satisfies:** Requirements 12.1, 16.6

- [ ] 7. Wire file validation into upload route (Gap 6)
  - Read existing `app/api/upload/route.ts` to confirm current implementation state
  - Parse the multipart form body to extract file buffer, declared MIME type, and file size
  - Call `validateFile(filename, declaredMimeType, sizeBytes, buffer, event.file_policy.allowed_types)` from `lib/services/file-validation.ts`; call `scanForMalware(buffer, filename)` from the same module
  - Return HTTP 422 with structured error envelope `{ code, message, field, details }` if either check returns a violation; on clean pass upload to Supabase Storage and return `{ path: storagePath }`
  - Ensure the route calls `requirePermission` before processing the upload
  - Write a unit test confirming a file with a disallowed MIME type returns 422 and a valid file proceeds to the storage upload step
  - **Satisfies:** Requirements 6.10, 12.3, 16.2

- [ ] 8. Add `requirePlatformAdmin` and enforce on admin layout (Gap 7)
  - Add `requirePlatformAdmin(): Promise<{ user: User }>` to `lib/auth/permissions.ts`; throw `AuthError` (UNAUTHENTICATED 401) if no session; throw `AuthError` (FORBIDDEN 403) if session exists but user does not have `PlatformAdmin` role in `workspace_members` or `is_admin` flag on `users`
  - Call `requirePlatformAdmin()` at the top of `app/(app)/admin/layout.tsx` (server component) so any non-admin visitor is redirected to a contextual access-denied page
  - Add JSDoc comment on any Supabase service-client RLS bypass inside `requirePlatformAdmin` documenting the bypass reason per Requirement 12.2
  - Write unit tests: non-admin user throws 403, unauthenticated request throws 401, PlatformAdmin user returns successfully
  - **Satisfies:** Requirements 12.1, 14.1, 14.8

- [ ] 9. Implement rate limiting on auth and public endpoints
  - Create or complete `lib/rate-limit.ts` exporting a `rateLimit(options: { limit: number; windowMs: number })` helper
  - Apply rate limiting to login, signup, and password-reset API routes: 5 failed attempts per 15 minutes per IP; exceeding returns HTTP 429 with `Retry-After` header
  - Apply rate limiting to public discovery and search endpoints
  - **Satisfies:** Requirements 1.6, 12.4

- [ ] 10. Implement `/api/health/ready` endpoint
  - Create `app/api/health/ready/route.ts` (GET handler)
  - Perform a lightweight DB liveness check (e.g., `SELECT 1` via Supabase client)
  - Perform a Stellar network reachability check (ping the configured Horizon base URL)
  - Return HTTP 200 `{ db: "ok", stellar: "ok" }` when both pass; return HTTP 503 `{ db: "error"|"ok", stellar: "error"|"ok", error?: string }` when either fails; ensure no stack traces or connection strings appear in the 503 body
  - **Satisfies:** Requirements 14.6, 16.7

- [ ] 11. Implement cron job routes (`process-events` and `reconcile`)
  - Create `app/api/cron/process-events/route.ts`: query events where `registration_deadline < now()` and `state = 'RegistrationOpen'`; advance each to `RegistrationClosed` via the event transition service; write an audit log entry per auto-transition with `actor_id = 'system'`
  - Create `app/api/cron/reconcile/route.ts`: query all `escrow_accounts` where `status NOT IN ('Released','Cancelled','Refunded')`; fetch live on-chain balance from the Soroban contract; update `available_balance` if it differs; write an audit log entry per reconciled discrepancy
  - Secure both cron routes with a `CRON_SECRET` header check so only the hosting scheduler can invoke them
  - Ensure both routes return 200 with a summary payload on success and 500 with a non-leaking error message on failure
  - **Satisfies:** Requirements 16.4

- [ ] 12. Enforce structured error envelope on all API responses
  - Confirm `lib/errors/responses.ts` exports `buildErrorResponse({ code, message, field?, details? })`; create or complete it if missing
  - Audit route handlers in `app/api/` and replace raw `throw` re-exports or `JSON.stringify(error)` calls with `buildErrorResponse`
  - Add a global error boundary (Next.js `middleware.ts` or shared `withErrorHandler` wrapper) that catches unhandled exceptions and returns the structured envelope instead of raw stack traces
  - Verify Zod `safeParse` failures surface as `{ code: 'VALIDATION_ERROR', message, field, details: issues[] }` in all routes
  - **Satisfies:** Requirements 11.5, 16.2, 12.6

- [ ] 13. Configure CI for deterministic property-based tests
  - Update `.github/workflows/ci.yml` to run `vitest run` (not watch mode) in the test step
  - Add `fc.configureGlobal({ seed: process.env.CI ? 42 : Date.now() })` to the global vitest setup file (`vitest.setup.ts` or equivalent)
  - Confirm the `test` script in `web/package.json` uses the `--run` flag
  - Add an ESLint step to the CI workflow (`eslint .`) that fails the pipeline on any error
  - **Satisfies:** Requirements 16.5, 16.6

- [ ] 14. Property 1 & 2 — Event state machine transitions and monotonicity
  - Extend `lib/state-machine/event.test.ts` with **Property 1**: for any state not reachable from `from` in the transition graph, `canEventTransition(from, to, ctx)` returns `ok: false` with non-empty `unmetPreconditions`; for any valid edge with all preconditions satisfied, it returns `ok: true` (numRuns: 100)
  - Extend the same file with **Property 2** (precondition monotonicity): for any context where `canEventTransition` returns `ok: true`, enriching the context with additional truthy values never flips the result to `ok: false` (numRuns: 100)
  - Run `vitest run lib/state-machine/event.test.ts` and confirm both properties pass
  - **Validates:** Requirements 10.2, 16.5, 6.1, 6.2, 6.3, 6.4

- [ ] 15. Property 3 & 4 — Escrow state machine round-trip funding and stroop tolerance
  - Create `lib/state-machine/__tests__/escrow.property.test.ts`
  - Implement **Property 3** (round-trip funding): for any `fundingTarget > 0` and `cumulativeConfirmedDeposits >= fundingTarget`, the escrow SM permits `PendingFunding → FullyFunded`; the resulting context satisfies `FullyFunded → Locked` when `reconciled === true` (numRuns: 100)
  - Implement **Property 4** (1-stroop tolerance): the fully-funded predicate returns `true` iff `Math.abs(balance - target) <= 0.0000001` for all floating-point-representable XLM amounts up to 10^9 (numRuns: 100)
  - Run the test file and confirm both properties pass
  - **Validates:** Requirements 9.2, 9.3, 8.8

- [ ] 16. Property 5 — Prize allocation sum invariant
  - Create `lib/services/__tests__/prize-allocation.property.test.ts`
  - Implement **Property 5**: for any `prize_pool_target T` and set of `prize_allocations`, the batch is valid iff `|sum(amount_i) - T| <= 0.0000001`; any violating batch returns HTTP 422 (numRuns: 100)
  - Run the test file and confirm the property passes
  - **Validates:** Requirements 8.8

- [ ] 17. Properties 6–10 — Team service invariants
  - Create `lib/services/__tests__/team.property.test.ts`
  - Implement **Property 6** (one-team-per-participant): for any user already in `team_members` for an event, `joinTeam` or `createTeam` throws `ConflictError` (numRuns: 100)
  - Implement **Property 7** (team size max): for any team at capacity `N = team_size_max`, `joinTeam` throws `BadRequestError` for all `team_size_max ∈ [1, 50]` (numRuns: 100)
  - Implement **Property 8** (captain transfer earliest-joined): when captain leaves a team of N ≥ 2 members with distinct `joined_at` values, `teams.captain_id` becomes the member with minimum `joined_at` (numRuns: 100)
  - Implement **Property 9** (solo auto-conversion completeness): after `autoConvertSoloParticipants` runs on an event with `team_size_min = 1`, every previously-unassigned participant has `team_status = 'in_team'` and a `teams` record with `captain_id = participant.user_id` (numRuns: 100)
  - Implement **Property 10** (all teams locked): after `TeamFormationLocked` transition, every `teams` record for the event has `locked = true` and the count of locked teams equals the count of active teams (numRuns: 100)
  - Run `vitest run lib/services/__tests__/team.property.test.ts` and confirm all five properties pass
  - **Validates:** Requirements 5.2, 5.3, 5.9, 5.11, 5.12

- [ ] 18. Properties 11 & 12 — Judging service weighted score and rubric bounds
  - Create `lib/services/judging/__tests__/judging.property.test.ts`
  - Implement **Property 11** (weighted score computation): for any non-empty `CriterionScore` list where each `score ∈ [0, maxScore]` and each `weight > 0`, `computeWeightedScore` equals `sum(score_i * weight_i) / sum(weight_i)` within tolerance `1e-9` (numRuns: 100)
  - Implement **Property 12** (rubric score bounds): for any submission where any criterion score exceeds `criterion.max_score` or is below 0, the evaluation service rejects with `ValidationError`; for all in-bounds scores, validation succeeds (numRuns: 100)
  - Run the test file and confirm both properties pass
  - **Validates:** Requirements 7.4, 7.7

- [ ] 19. Property 13 — Evaluation COI judge-team membership
  - Create `lib/services/__tests__/evaluation.property.test.ts`
  - Implement **Property 13**: for any `(judgeId, submissionId)` where the judge is a member of the submitting team, `createEvaluation` throws `ForbiddenError` with code `CONFLICT_OF_INTEREST`; for any pair where the judge is not on the team, no COI error is thrown (numRuns: 100)
  - Run the test file and confirm the property passes
  - **Validates:** Requirements 7.6

- [ ] 20. Property 14 — Application duplicate prevention
  - Create `lib/services/__tests__/application.property.test.ts`
  - Implement **Property 14**: for any `(userId, eventId)` pair where an `event_members` record already exists, a second application returns HTTP 409 regardless of the existing record's current state (numRuns: 100)
  - Run the test file and confirm the property passes
  - **Validates:** Requirements 4.2

- [ ] 21. Property 15 — File validation MIME type policy
  - Extend `lib/services/file-validation.test.ts` with **Property 15**: for any file whose detected MIME type is not in `file_policy.allowed_types`, `validateFile` returns `{ valid: false, violations: [...] }` with at least one violation mentioning the disallowed type; for any file whose type is in the allowed set, no type violation appears (numRuns: 100)
  - Run `vitest run lib/services/file-validation.test.ts` and confirm the new property passes alongside existing tests
  - **Validates:** Requirements 6.10

- [ ] 22. Property 16 — Optimistic concurrency version conflict detection
  - Create `lib/services/__tests__/concurrency.property.test.ts`
  - Implement **Property 16**: for any versioned entity (events, teams, evaluations, escrow_accounts) at version `V`, two concurrent updates presenting `version = V` result in exactly one 200 and one 409 with `conflictVersion`; the winning write increments version to `V + 1` (numRuns: 100)
  - Run the test file and confirm the property passes
  - **Validates:** Requirements 11.8, 16.9

- [ ] 23. Property 17 — Event discovery filter correctness
  - Create `lib/services/__tests__/discovery.property.test.ts`
  - Implement **Property 17**: for any filter predicate over `(category, format, network_mode, tags)`, every returned event satisfies the predicate; no event that fails any active filter appears in results (numRuns: 100)
  - Run the test file and confirm the property passes
  - **Validates:** Requirements 3.2

- [ ] 24. Property 18 — Dispute state machine terminal state immutability
  - Create `lib/state-machine/__tests__/dispute.property.test.ts`
  - Implement **Property 18**: for any dispute in a terminal state (`Upheld`, `Dismissed`, `Withdrawn`), `canDisputeTransition(state, anyTarget, ctx)` returns `ok: false` and `validOutbound: []` (numRuns: 100)
  - Run the test file and confirm the property passes
  - **Validates:** Requirements 8.6

- [ ] 25. Property 19 — Audit record written for every state transition
  - Create `lib/services/__tests__/audit.property.test.ts`
  - Implement **Property 19**: for any successful event, evaluation, or escrow state transition, an `audit_records` row exists with matching `action`, `actor_id`, and `resource_id`; no transition succeeds without a corresponding audit record (numRuns: 100)
  - Run the test file and confirm the property passes
  - **Validates:** Requirements 4.8, 6.9, 7.11

- [ ] 26. Property 20 — Structured error envelope on all validation failures
  - Create `lib/errors/__tests__/responses.property.test.ts`
  - Implement **Property 20**: for any API request that fails Zod schema validation, the response body conforms to `{ code: string, message: string, field?: string, details?: unknown }`; no raw stack traces or empty bodies appear in 422 responses (numRuns: 100)
  - Run the test file and confirm the property passes
  - **Validates:** Requirements 11.5, 16.2

## Notes

- All database migrations must be idempotent (using `IF NOT EXISTS` / `IF NOT EXISTS` guards) and versioned via Supabase migrations directory. No migration may drop data without an explicit admin confirmation step (Requirement 16.8).
- All property-based tests use `fast-check` + `vitest` with `numRuns: 100` minimum and the file header comment `// Feature: stellar-guardian-production-audit, Property N: <property_text>`. In CI the fast-check seed is deterministic: `fc.configureGlobal({ seed: process.env.CI ? 42 : Date.now() })`.
- Tasks 1–3 (migrations) have no dependencies and can be executed in parallel.
- Tasks 4–5 (service layer) depend on migrations being applied and types regenerated.
- Tasks 14–26 (property tests) should be run after their corresponding gap-fix tasks are complete, as indicated in the dependency graph below.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "description": "Database Migrations — no dependencies",
      "tasks": ["1", "2", "3"]
    },
    {
      "wave": 2,
      "description": "Service Layer — depends on migrations (Tasks 1, 2, 3)",
      "tasks": ["4", "5"]
    },
    {
      "wave": 3,
      "description": "Route Fixes and Auth/RBAC — depends on Task 4 (judging service) for error types",
      "tasks": ["6", "7", "8"]
    },
    {
      "wave": 4,
      "description": "Production Hardening — depends on Tasks 4, 5, 7, 8",
      "tasks": ["9", "10", "11", "12", "13"]
    },
    {
      "wave": 5,
      "description": "Property-Based Tests — depends on all gap-fix tasks; Tasks 14-15-16 can run after wave 1; Tasks 17-18-19-20-21-22-25 depend on wave 2-3",
      "tasks": ["14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26"]
    }
  ],
  "dependencies": {
    "4": ["1"],
    "5": ["2", "4"],
    "6": [],
    "7": ["1"],
    "8": [],
    "9": [],
    "10": [],
    "11": ["4", "5"],
    "12": ["4"],
    "13": [],
    "14": [],
    "15": [],
    "16": [],
    "17": ["5"],
    "18": ["4"],
    "19": ["4"],
    "20": ["1"],
    "21": ["7"],
    "22": ["2", "4"],
    "23": [],
    "24": [],
    "25": ["4", "5"],
    "26": ["12"]
  }
}
```
