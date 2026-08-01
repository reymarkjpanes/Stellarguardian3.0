# Requirement 2: Event Lifecycle State Machine Alignment — Comprehensive Analysis

## Executive Summary
This analysis details the current implementation, architectural gaps, state mapping, and step-by-step technical design for **Requirement 2: Event Lifecycle State Machine Alignment in Stellar Guardian 3.0**. 

The goal of Requirement 2 is to provide explicit state transition controls on the Event Dashboard that mirror the granular database state, enforce backend validation without UI divergence, and require accessible confirmation dialogs for irreversible and high-risk actions (such as locking submissions, starting judging, approving prizes, and releasing escrow).

---

## 1. Existing Codebase & Schema Inspection

### 1.1 Database Schema & Enums
- **Migration Schema (`web/supabase/migrations/20250101000004_events.sql` & `web/supabase/combined_migration.sql`)**:
  The `events` table defines `state text not null default 'Draft'`, constrained by a CHECK constraint mirroring 18 canonical states:
  `Draft`, `Review`, `Published`, `RegistrationOpen`, `RegistrationClosed`, `TeamFormationLocked`, `SubmissionOpen`, `SubmissionClosed`, `JudgingRound1`, `JudgingRound2`, `WinnerVerification`, `DisputeWindow`, `PrizeApproved`, `EscrowRelease`, `Completed`, `Cancelled`, `Suspended`, `Archived`.
- **TypeScript Model (`web/types/enums.ts`)**:
  Exports `EventStateSchema` (Zod enum) and `EventState` type with the exact 18 canonical string literals (lines 13–33).

### 1.2 Pure State Machine & Business Rules Engines
- **State Machine Graph (`web/lib/state-machine/event.ts`)**:
  Implements `canEventTransition(from, to, ctx)` and `validEventOutboundStates(from, ctx)`. Returns a `TransitionResult` object with `ok: boolean`, `validOutbound: EventState[]`, and `unmetPreconditions: string[]`.
- **Workflow Engine (`web/lib/engines/workflow/event-workflow.ts`)**:
  Wraps business rule functions (`EventBusinessRules`) with the 18-state canonical transition graph. Provides `EventWorkflowEngine.canTransition(from, to, ctx)`.

### 1.3 API Endpoint
- **Endpoint Path (`web/app/api/events/[id]/state/route.ts`)**:
  - `PATCH /api/events/[id]/state` accepts `{ target_state: string }`.
  - Enforces authentication and authorization (`Organizer`, `PlatformAdmin`, `WorkspaceOwner`, `WorkspaceAdmin`, or event `organizer_id`).
  - Gathers live context (`judgeCount`, `submissionCount`, `registrationCount`, `unresolvedDisputes`, `escrow.state`, `allSubmissionsScored`, `reviewWindowElapsed`).
  - Validates transition with `EventWorkflowEngine.canTransition(event.state, targetState, ctx)`.
  - Performs optimistic concurrency update (`version: event.version + 1`).
  - Returns `422 Unprocessable Entity` with `details.unmetPreconditions` on failure, or `409 Conflict` on concurrent edit.

### 1.4 Dashboard UI Components
- **Client Component (`web/app/(app)/events/[id]/event-detail-client.tsx`)**:
  - Contains `handleStateChange(newState)` (lines 54–86).
  - Renders inline `ActionButton` items inside lines 228–434 conditionally based on `event.state`.
- **Primitive Dialog (`web/components/ui/modal.tsx`)**:
  - Accessible modal dialog component supporting open/close state, overlay blur, animations, and body scrolling lock.

---

## 2. Granular Event Lifecycle State Mapping

The 18 canonical event states are mapped into their corresponding operational phases, transition capabilities, and risk profiles below:

| # | Granular DB State | Operational Phase | Description & Happy Path Flow | Irreversible Action? | Confirmation Required? |
|---|---|---|---|---|---|
| 1 | `Draft` | Setup | Initial event creation; configuration mutable. | No | No |
| 2 | `Review` | Setup | Optional internal organizer/admin review. | No | No |
| 3 | `Published` | Setup | Event published and publicly visible. | **Yes** (Public visibility) | Yes |
| 4 | `RegistrationOpen` | Registration | Participants can register and apply. | No | No |
| 5 | `RegistrationClosed` | Registration | Registration deadline passed; participant list frozen. | No | No |
| 6 | `TeamFormationLocked` | Registration | Team rosters frozen; participants cannot leave/join teams. | **Yes** | Yes |
| 7 | `SubmissionOpen` | Submission | Teams build and submit project repos/demos. | No | No |
| 8 | `SubmissionClosed` | Submission | Submissions closed; project code frozen against edits. | **Yes** | Yes |
| 9 | `JudgingRound1` | Judging | Round 1 scoring active for assigned judges. | **Yes** | Yes |
| 10 | `JudgingRound2` | Judging | Optional Round 2 scoring for shortlisted teams. | **Yes** | Yes |
| 11 | `WinnerVerification` | Winners | Scoring finalized; organizers review winner placements. | **Yes** | Yes |
| 12 | `DisputeWindow` | Winners | Preliminary rankings published; dispute window active. | **Yes** | Yes |
| 13 | `PrizeApproved` | Winners | Dispute window closed; prize allocations approved. | **Yes** | Yes |
| 14 | `EscrowRelease` | Escrow | On-chain payout execution triggered on Stellar. | **Yes** (Financial) | Yes (Type to confirm) |
| 15 | `Completed` | Escrow | All disbursements completed; judge scores published. | **Yes** | Yes |
| 16 | `Cancelled` | Terminal | Event cancelled; funds queued for escrow refund. | **Yes** (Terminal) | Yes (Type to confirm) |
| 17 | `Suspended` | Operational Hold | Event temporarily suspended for safety/audit. | No | Yes |
| 18 | `Archived` | Terminal | Soft-deleted / historical record state. | **Yes** | Yes |

---

## 3. Identification of Current Gaps & UI Divergence

### Gap 1: Hardcoded UI Branching vs Dynamic Outbound Transition Evaluation
In `event-detail-client.tsx`, transition buttons are rendered using rigid `if (event.state === "Draft")` checks.
- **Problem**: In `RegistrationClosed`, the state machine allows transitions to `TeamFormationLocked` OR `SubmissionOpen`. The UI only renders a button for `TeamFormationLocked`.
- **Problem**: UI buttons are displayed without pre-evaluating precondition rules. Buttons appear enabled even when missing required data (e.g. 0 judges assigned), leading to unexpected errors only *after* button click.

### Gap 2: Usage of Native `window.confirm()` Browser Popups
Lines 306–313, 337–344, 401–408, 423–426 of `event-detail-client.tsx` use primitive `if (confirm(...))` calls.
- **Problem**: Browser `confirm()` popups violate accessibility (WCAG), cannot display structured warnings (e.g., number of affected teams or financial amounts), are easily blocked by browsers, and look unstyled.
- **Problem**: Crucial state transitions such as **"Close Submissions"** (`SubmissionOpen` -> `SubmissionClosed`), **"Skip Round 2"** (`JudgingRound1` -> `WinnerVerification`), and **"Release Escrow"** (`PrizeApproved` -> `EscrowRelease`) currently have **NO confirmation dialog at all**!

### Gap 3: Missing Contextual Error Feedback
When `PATCH /api/events/[id]/state` returns `422`, the UI displays a generic string banner. It does not map unmet preconditions back to specific action buttons or provide direct links to resolve missing requirements (e.g. "Assign Judges" link when `judgeCount < 1`).

---

## 4. Technical Design & Step-by-Step Implementation Plan

### 4.1 Frontend Architecture Refactoring

1. **State Transition Configuration Object (`web/config/event-transitions.ts`)**:
   Create a centralized specification mapping every valid state transition to UI metadata:
   ```typescript
   export interface TransitionMetadata {
     targetState: EventState;
     label: string;
     variant: "primary" | "secondary" | "danger" | "warning";
     isIrreversible: boolean;
     requiresInputConfirmation?: boolean;
     confirmationInputText?: string;
     modalTitle: string;
     modalDescription: string;
     warningBulletPoints: string[];
   }
   ```

2. **Confirmation Dialog Modal Component (`web/components/events/confirm-transition-modal.tsx`)**:
   Build an accessible modal using `web/components/ui/modal.tsx` supporting:
   - Dynamic header with risk badge (e.g., "Irreversible Action", "Financial Payout").
   - Impact summary (e.g., "This will lock 14 project submissions and prevent further edits by 38 participants").
   - Precondition readiness indicator.
   - Text verification field for high-risk actions (e.g., requiring user to type `"CANCEL"` or `"RELEASE"`).
   - Async loading state on submit button during API request.

3. **Dynamic Transition Controls Component (`web/components/events/event-state-controls.tsx`)**:
   - Evaluates valid outbound transitions for current state.
   - Computes enabled/disabled state and unmet precondition tooltips using `canEventTransition`.
   - Renders action buttons dynamically with appropriate badges and onClick triggers for the modal dialog.

### 4.2 Backend & API Enhancements

1. **API Outbound Payload (`web/app/api/events/[id]/state/route.ts`)**:
   Enhance `PATCH /api/events/[id]/state` to return the updated event object along with `validOutboundStates`:
   ```json
   {
     "data": {
       "event": { ... },
       "validOutboundStates": ["TeamFormationLocked", "SubmissionOpen", "Cancelled"]
     }
   }
   ```

2. **Automated Submission Locking Side-Effects**:
   When event transitions to `SubmissionClosed` or `JudgingRound1`, automatically execute database update ensuring all draft submissions for the event transition to `Locked` or `Under Review` status to prevent race conditions.

---

## 5. Verification & Test Plan

1. **Unit & Property Tests**:
   - Run `vitest run web/lib/state-machine/event.test.ts` to verify state graph rules.
   - Add unit tests for `confirm-transition-modal.tsx` verifying open/close states and text input validation.
2. **Integration Verification**:
   - Simulate organizer state transitions across all 18 states on local dev environment.
   - Verify modal opens for irreversible transitions ("Lock Submissions", "Begin Judging", "Release Escrow", "Cancel Event").
   - Verify disabled state and error surfacing when preconditions are unmet.
