# Project: Stellar Guardian 3.0 — Organizer Journey Fixes

## Architecture
- Stack: Next.js App Router (`web/`), Supabase (`supabase/`), Soroban Rust Contracts (`contracts/`).
- Web App: React 18/19 components, Tailwind CSS, Lucide icons.
- Database: PostgreSQL / Supabase schema (workspaces, events, prizes, escrow payouts).
- Blockchain: Soroban Smart Contracts (`contracts/escrow/src/lib.rs`, `web/lib/stellar/soroban-escrow.ts`).

## Code Layout
- `web/app/(app)/dashboard/page.tsx`: Protected dashboard page (server component)
- `web/app/(app)/onboarding/page.tsx`: Onboarding page (client component)
- `web/components/layout/app-nav.tsx`: Client navigation bar guard
- `web/app/api/workspaces/route.ts` & `web/lib/services/workspace.ts`: Workspace creation service
- `web/app/api/users/me/route.ts`: User profile API endpoint
- `web/app/(app)/events/[id]/event-detail-client.tsx`: Event detail dashboard client component
- `web/lib/state-machine/event.ts`: Canonical 18-state event workflow engine
- `web/app/api/events/[id]/state/route.ts`: Server-side state transition API endpoint
- `web/components/ui/modal.tsx`: Accessible modal component primitive
- `web/app/api/cron/escrow/route.ts` & `web/app/api/webhooks/escrow-trigger/route.ts`: Automated escrow trigger
- `web/lib/stellar/soroban-escrow.ts`: Soroban RPC disbursement functions (`lockEscrow`, `executeSorobanDisbursementBatch`, `finalizeDisbursement`)
- `contracts/escrow/src/lib.rs`: Soroban Rust escrow contract

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 0 | Codebase Exploration | Deep dive into codebase for R1, R2, R3 | none | DONE |
| 1 | E2E Test Track | Build opaque-box E2E tests for R1, R2, R3 & publish `TEST_READY.md` | M0 | IN_PROGRESS |
| 2 | R1 Organizer Onboarding | `/onboarding` page & `/dashboard` blocking guard | M0 | IN_PROGRESS |
| 3 | R2 Event Lifecycle State Machine | State transition buttons & confirmation dialogs | M0 | PLANNED |
| 4 | R3 Automated Escrow Trigger | Auto-trigger Soroban payout on `PrizeApproved` | M0 | PLANNED |
| 5 | E2E Verification & Hardening | 100% E2E test pass + Tier 5 adversarial checks | M1-M4 | PLANNED |

## Interface Contracts
### R1 Onboarding ↔ Dashboard
- `/dashboard/page.tsx`: Server component guard checks `profile?.display_name` (non-null/non-empty/not default email) AND `rawWorkspaceMemberships.length > 0`. Redirects to `/onboarding` if either check fails.
- `/onboarding/page.tsx`: Renders form for `displayName` and `workspaceName`. On submit, calls `PATCH /api/users/me` and `POST /api/workspaces`, then redirects to `/dashboard`.
- `app-nav.tsx`: Client-side navigation guard enforces redirect to `/onboarding` if profile or workspace is missing.

### R2 Event Lifecycle State Machine
- API Endpoint: `PATCH /api/events/[id]/state` validating transition via `EventWorkflowEngine` and updating state with optimistic lock (`version: version + 1`).
- UI Controls (`event-detail-client.tsx`): Dynamic transition buttons evaluated via `validEventOutboundStates` / `canEventTransition`.
- Modal Component (`ConfirmTransitionModal`): Renders confirmation dialog modal for irreversible state transitions ("Lock Team Formation", "Close Submissions", "Begin Judging", "Release Escrow", "Cancel Event").

### R3 Automated Escrow Trigger
- Trigger Route (`POST /api/webhooks/escrow-trigger` and `POST /api/cron/escrow`): Detects `events.state === 'PrizeApproved'`.
- Safety Validation: Checks zero open disputes in `disputes` table, checks `escrow_accounts.state === 'FullyFunded'`, applies optimistic concurrency lock on `events.version`.
- Soroban Execution: Calls `lockEscrow()`, `executeSorobanDisbursementBatch()`, and `finalizeDisbursement()` in `web/lib/stellar/soroban-escrow.ts`, storing `tx_hash` in `payout_instructions`.
