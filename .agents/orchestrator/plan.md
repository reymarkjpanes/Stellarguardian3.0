# Project Plan — Stellar Guardian 3.0 Organizer Journey Fixes

## Overview
Fix gaps in the Organizer Journey of Stellar Guardian 3.0:
1. **R1. Organizer Onboarding Flow**: `/onboarding` page blocking `/dashboard` until display name and default workspace are configured.
2. **R2. Event Lifecycle State Machine Alignment**: Explicit state transition buttons on Event Dashboard with confirmation dialogs for irreversible actions.
3. **R3. Automated Escrow Trigger**: Automated background job or webhook watching for `PrizeApproved` state to auto-trigger Soroban smart contract payouts.

## Phases & Milestones

### Phase 1: Exploration & Architecture Baseline
- Spawn 3 parallel `teamwork_preview_explorer` subagents to investigate:
  - Explorer 1: Frontend routes, middleware, workspace context, `/dashboard`, `/onboarding` status.
  - Explorer 2: Event state machine in DB/API, granular state transitions, UI components.
  - Explorer 3: Escrow / Soroban contract integrations, `PrizeApproved` status handling, background jobs/webhooks setup.

### Phase 2: Dual Track Setup (E2E Test Track & Implementation Track)
- **E2E Test Track**: Build comprehensive opaque-box test suite (Tiers 1-4: Feature coverage, Boundary/Corner cases, Cross-Feature, Real-World Scenarios) and publish `TEST_READY.md`.
- **Implementation Track**: Define interface contracts and code layout in `PROJECT.md`.

### Phase 3: Milestone Implementations
- **Milestone R1 (Onboarding)**: Worker -> Reviewer -> Challenger -> Auditor.
- **Milestone R2 (Event Lifecycle State Machine)**: Worker -> Reviewer -> Challenger -> Auditor.
- **Milestone R3 (Automated Escrow Trigger)**: Worker -> Reviewer -> Challenger -> Auditor.

### Phase 4: Final E2E Test Pass & Adversarial Hardening
- **Phase 1**: Pass 100% of E2E tests (Tiers 1-4).
- **Phase 2**: Adversarial Coverage Hardening (Tier 5 white-box challenger loop).

### Phase 5: Synthesis & Reporting
- Final audit verification (CLEAN verdict required).
- Comprehensive report to user.
