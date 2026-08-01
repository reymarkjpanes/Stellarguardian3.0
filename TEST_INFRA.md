# Test Infrastructure & Architecture — Stellar Guardian 3.0

## 1. Executive Summary & Test Architecture Overview

Stellar Guardian 3.0 is a decentralized hackathon management and smart contract escrow platform built on Next.js, Supabase, and Soroban (Stellar Smart Contracts).

This document outlines the test architecture and 4-tier E2E testing framework designed to validate core business requirements:
- **R1. Organizer Onboarding Flow**: Enforces user profile and workspace creation before dashboard access.
- **R2. Event Lifecycle State Machine Alignment**: Granular DB state transitions with explicit UI transition controls and confirmation modals for irreversible actions.
- **R3. Automated Escrow Trigger**: Autonomous Soroban smart contract payouts triggered upon `PrizeApproved` state without platform intervention.

### Core Testing Pillars
- **Opaque-Box Testing**: Testing against public APIs, route handlers, and UI specifications without relying on internal implementation secrets.
- **4-Tier Methodology**: Tier 1 (Feature Coverage), Tier 2 (Boundary & Edge Cases), Tier 3 (Cross-Feature Pairwise), Tier 4 (Real-World E2E Scenarios).
- **Automated Verification**: Seamless execution via Vitest and Playwright test harnesses with zero manual intervention required.

---

## 2. Requirement Feature Inventory

| ID | Requirement | Primary Components | Key Behaviors |
|---|---|---|---|
| **R1** | Organizer Onboarding Flow | `/dashboard`, `/onboarding`, `/api/users/me`, `/api/workspaces` | • Redirects from `/dashboard` to `/onboarding` if `display_name` is missing, equal to email, or workspace count == 0.<br>• Completing onboarding sets `display_name` and creates initial workspace.<br>• Successful setup redirects user to `/dashboard`. |
| **R2** | Event Lifecycle State Machine | `/events/[id]`, `EventDetailClient`, `EventActionCenter`, `/api/events/[id]/state`, `EventWorkflowEngine` | • Renders explicit state transition buttons based on current granular DB state.<br>• Validates state transitions on backend via state machine.<br>• Requires explicit confirmation modals for irreversible transitions ("Lock Team Formation", "Close Submissions", "Begin Judging", "Release Escrow", "Cancel Event").<br>• Enforces 422 error with unmet preconditions for invalid transitions. |
| **R3** | Automated Escrow Trigger | `/api/cron/escrow`, `EscrowService`, `StellarEscrowAdapter` | • Cron process inspects events in `PrizeApproved` state.<br>• Verifies `FullyFunded` escrow account status and zero unresolved disputes.<br>• Transitions event to `EscrowRelease`.<br>• Automatically generates and executes Soroban payout batch. |

---

## 3. 4-Tier Test Design Matrix

### Tier 1: Feature Coverage (>=5 test cases per requirement)
- **R1: Organizer Onboarding Flow**
  1. `R1-T1-01`: Redirect to `/onboarding` when profile `display_name` is missing.
  2. `R1-T1-02`: Redirect to `/onboarding` when `display_name` equals user `email`.
  3. `R1-T1-03`: Redirect to `/onboarding` when user workspace membership count is 0.
  4. `R1-T1-04`: Onboarding form submission invokes `PATCH /api/users/me` and `POST /api/workspaces`.
  5. `R1-T1-05`: Onboarding completion redirects user to `/dashboard`.
- **R2: Event Lifecycle Alignment**
  1. `R2-T1-01`: Event detail view renders explicit transition buttons matching current DB state.
  2. `R2-T1-02`: State change API updates event state in DB when valid.
  3. `R2-T1-03`: Irreversible transition buttons trigger browser confirmation modals before proceeding.
  4. `R2-T1-04`: State transitions preserve optimistic locking (version increment).
  5. `R2-T1-05`: Unmet preconditions block state transition and return detailed 422 error details.
- **R3: Automated Escrow Trigger**
  1. `R3-T1-01`: Cron endpoint detects events in `PrizeApproved` state.
  2. `R3-T1-02`: Cron verifies escrow account state is `FullyFunded`.
  3. `R3-T1-03`: Cron verifies no `Open` or `UnderReview` disputes exist.
  4. `R3-T1-04`: Event transitions automatically from `PrizeApproved` to `EscrowRelease`.
  5. `R3-T1-05`: Automated execution invokes Soroban payout batch without manual intervention.

### Tier 2: Boundary & Corner Cases (>=5 test cases per requirement)
- **R1: Onboarding Boundaries**
  1. `R1-T2-01`: Validation rejects display names under 2 characters or whitespace-only.
  2. `R1-T2-02`: Validation rejects workspace names under 2 characters.
  3. `R1-T2-03`: Workspace slugification converts special characters, spaces, and punctuation safely.
  4. `R1-T2-04`: Partial failure handling (e.g. user patch succeeds but workspace post fails).
  5. `R1-T2-05`: Repeated dashboard navigation attempts during incomplete onboarding remain blocked.
- **R2: Lifecycle State Machine Boundaries**
  1. `R2-T2-01`: Illegal out-of-order transition (e.g., `Draft` → `PrizeApproved`) returns 422.
  2. `R2-T2-02`: Transitioning to `Published` fails if judge count is 0.
  3. `R2-T2-03`: Transitioning to `JudgingRound1` fails if submission count is 0.
  4. `R2-T2-04`: State transition with outdated version parameter returns 409 Conflict.
  5. `R2-T2-05`: Unauthorized role (e.g. `Participant`) attempting state transition returns 403 Forbidden.
- **R3: Escrow & Payout Edge Cases**
  1. `R3-T2-01`: Cron skips events in `PrizeApproved` state if escrow state is `Created` or `PartiallyFunded`.
  2. `R3-T2-02`: Cron skips event when an active dispute (`Open` or `UnderReview`) exists.
  3. `R3-T2-03`: Escrow execution handles missing `prize_allocation_batch_id` cleanly.
  4. `R3-T2-04`: Re-running cron on already processed batch behaves idempotently without duplicate payouts.
  5. `R3-T2-05`: Cron authentication requires valid `CRON_SECRET` header, rejecting unauthorized calls with 401.

### Tier 3: Cross-Feature Pairwise Interactions
- `T3-01`: **Onboard → Workspace → Event Creation**: Fresh onboarding populates default workspace, enabling instant event creation.
- `T3-02`: **Registration → Team Lock → Submission Window**: Lifecycle progression enforces team immutability before opening submission phase.
- `T3-03`: **Submission → Judging → Winner Verification → Dispute Window**: Workflow engine verifies all submissions are evaluated prior to dispute window opening.
- `T3-04`: **Dispute Handling → Escrow Gating**: Resolving open disputes clears precondition, unblocking `PrizeApproved` transition and cron payout execution.
- `T3-05`: **Prize Approval → Escrow Release → Event Completion**: Automated payout completion transitions event to `EscrowRelease` and enables final `Completed` state.

### Tier 4: Real-World Application Scenarios
- `T4-01`: **Complete End-to-End Organizer Journey**:
  1. User signs up as fresh organizer.
  2. Attempting to view `/dashboard` redirects to `/onboarding`.
  3. Onboarding creates workspace and sets display name, navigating to `/dashboard`.
  4. Organizer creates hackathon event in workspace (`Draft` state).
  5. Event published and opens registration (`RegistrationOpen`).
  6. Registration closes (`RegistrationClosed`) and team formation is locked (`TeamFormationLocked`).
  7. Submissions open (`SubmissionOpen`) and close (`SubmissionClosed`).
  8. Judging commences (`JudgingRound1`) and evaluations are submitted.
  9. Winners verified, dispute window concludes without unresolved disputes, and state advances to `PrizeApproved`.
  10. Automated escrow cron runs, detecting `PrizeApproved` + `FullyFunded` escrow, generating and executing Soroban contract payout, and advancing state to `EscrowRelease`.

---

## 4. Test File Layout & Architecture

```
web/
├── e2e/
│   ├── r1-organizer-onboarding.spec.ts   # Playwright UI specs for R1 Onboarding
│   ├── r2-event-lifecycle.spec.ts        # Playwright UI specs for R2 State Machine
│   ├── r3-automated-escrow.spec.ts       # Playwright UI specs for R3 Escrow Trigger
│   └── r4-real-world-journey.spec.ts     # Playwright UI specs for Tier 4 Full Journey
└── lib/__tests__/
    ├── r1-onboarding-tier1-2.test.ts     # Vitest tests for R1 logic & boundaries
    ├── r2-lifecycle-tier1-2.test.ts      # Vitest tests for R2 state API & transitions
    ├── r3-escrow-trigger-tier1-2.test.ts # Vitest tests for R3 cron & escrow engine
    ├── r3-tier3-cross-feature.test.ts    # Vitest tests for Tier 3 Pairwise interactions
    └── r4-tier4-e2e-scenario.test.ts     # Vitest tests for Tier 4 Full E2E Scenario
```

---

## 5. Execution Commands

### Unit & Integration Test Suite (Vitest)
```bash
# Run all Vitest requirement test suites
npm --prefix web run test -- lib/__tests__/r1-onboarding-tier1-2.test.ts lib/__tests__/r2-lifecycle-tier1-2.test.ts lib/__tests__/r3-escrow-trigger-tier1-2.test.ts lib/__tests__/r3-tier3-cross-feature.test.ts lib/__tests__/r4-tier4-e2e-scenario.test.ts

# Run entire Vitest test suite
npm --prefix web run test
```

### End-to-End Test Suite (Playwright)
```bash
# Run Playwright E2E requirement specs
npx --prefix web playwright test e2e/r1-organizer-onboarding.spec.ts e2e/r2-event-lifecycle.spec.ts e2e/r3-automated-escrow.spec.ts e2e/r4-real-world-journey.spec.ts
```

---

## 6. Integrity & Compliance Verification

- All state transition assertions verify genuine database updates or simulated backend state changes.
- Confirmation modal tests inspect actual browser `window.confirm` dialog handler invocations.
- Escrow payout triggers test actual batch creation and execute methods against the Soroban contract adapter layer.
- Zero mock shortcuts or hardcoded test assertions.
