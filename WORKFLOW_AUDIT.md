# Workflow Audit — StellarGuardian 3.0

## 1. End-to-End Business Workflow

### Canonical Flow

```
Workspace Creation
       ↓
Event Creation (Draft)
       ↓
Registration Open → Team Formation → Submission Open
       ↓
Submission Closed → Judging → Rankings
       ↓
Winner Verification → Dispute Window
       ↓
Prize Allocation → Escrow Funding
       ↓
Payout Simulation → On-chain Disbursement
       ↓
Settlement → Analytics / Archive
```

### Workflow Connectivity Assessment

| Step | Previous Step | Connected? | Evidence |
|------|-------------|-----------|----------|
| Workspace → Event | Workspace exists | ✅ | `events.workspace_id FK` |
| Event → Registration | Event published | ⚠️ | State machine exists but DB has `RegistrationOpen` state while code uses `Active` |
| Registration → Team | Registration closed | ✅ | `TeamFormationLocked` state in DB |
| Team → Submission | Teams formed | ✅ | `SubmissionOpen` state in DB |
| Submission → Judging | Submissions closed | ✅ | `JudgingRound1` state in DB |
| Judging → Rankings | All scored | ✅ | `allSubmissionsScored` precondition |
| Rankings → Winners | Rankings finalized | ⚠️ | `FinalizationService` exists but connection to event state unclear |
| Winners → Disputes | Winners announced | ✅ | `DisputeWindow` state with `review_window_hours` |
| Disputes → Prize | All resolved | ✅ | `unresolvedDisputes === 0` precondition |
| Prize → Escrow | Prize approved | ✅ | `PrizeApproved` state in DB |
| Escrow → Disbursement | Escrow locked | ✅ | `EscrowRelease` state, `Locked` escrow state |
| Disbursement → Settlement | All paid | ⚠️ | Settlement table exists but no service |
| Settlement → Archive | Settled | ⚠️ | `Completed` → `Archived` transition exists |

---

## 2. State Machine Workflow Analysis

### Event Lifecycle (16/18 DB States vs. 5 Code States)

**DB CHECK constraint (18 states)**:
Draft, Review, Published, RegistrationOpen, RegistrationClosed, TeamFormationLocked, SubmissionOpen, SubmissionClosed, JudgingRound1, JudgingRound2, WinnerVerification, DisputeWindow, PrizeApproved, EscrowRelease, Completed, Cancelled, Suspended, Archived

**Code EventWorkflowEngine (5 states)**:
Draft, Active, Completed, Cancelled, Archived

**Problem**: The DB enforces granular states but the code can only transition between 5 high-level states. Events created with DB states like `RegistrationOpen` or `JudgingRound1` would fail Zod validation in API responses.

### Escrow Lifecycle (Well-Aligned)

DB and code both use 9 states: PendingFunding → PartiallyFunded → FullyFunded → Locked → PendingRelease → Released / Refunded / Failed / Cancelled

✅ Good alignment between DB, Zod schema, and state machine code.

### Dispute Lifecycle (Well-Aligned)

DB and code both use 5 states: Open → UnderReview → Upheld / Dismissed / Withdrawn

✅ Good alignment.

---

## 3. Workflow Gap Analysis

### Missing Workflow Steps

| Gap | Expected | Actual | Impact |
|-----|----------|--------|--------|
| Event Review (Draft → Review → Published) | Design doc specifies | No `Review` state in code | Events go directly from Draft to Active/Published |
| Judging Rounds (Round1 → Round2) | DB has both states | No multi-round judging logic | Only single-round judging works |
| Winner Verification step | DB has `WinnerVerification` | No service implements this | Winners finalized without verification |
| Prize Approval step | DB has `PrizeApproved` | No approval workflow | Prize allocation happens without explicit approval |
| Escrow Release coordination | DB has `EscrowRelease` | Disbursement service exists but no trigger | Manual API call needed |
| Settlement recording | `settlements` table exists | No settlement service | Escrow reaches terminal without recording settlement |

### Dead States in DB

These states exist in the DB CHECK constraint but have no code path to reach them:
- `Review` — No transition target in workflow engine
- `Suspended` — No suspension logic exists
- `JudgingRound2` — No multi-round judging implemented

---

## 4. Workflow Dependencies and Preconditions

### Event Activation (Draft → Active)

| Precondition | Enforced? | Location |
|-------------|-----------|----------|
| At least 1 judge assigned | ✅ | `EventBusinessRules.requiresJudges` |
| Registration deadline configured | ✅ | `EventBusinessRules.requiresRegistrationDeadline` |
| Escrow fully funded on-chain | ✅ | `EventBusinessRules.escrowFullyFunded` |
| Minimum participants met | Defined but not wired | `EventBusinessRules.minimumParticipantsMet` (unused in workflow) |

### Event Completion (Active → Completed)

| Precondition | Enforced? | Location |
|-------------|-----------|----------|
| All submissions scored | ✅ | `EventBusinessRules.allSubmissionsScored` |
| Zero unresolved disputes | ✅ | `EventBusinessRules.zeroUnresolvedDisputes` |
| KYC satisfied | ✅ | `EventBusinessRules.kycSatisfied` |
| Review window elapsed | Defined but not used here | `EventBusinessRules.reviewWindowElapsed` (used in escrow only) |

### Escrow Locking (FullyFunded → Locked)

| Precondition | Enforced? | Location |
|-------------|-----------|----------|
| On-chain balance matches expected | ✅ | `reconciled(ctx)` check |
| Must be automated transition | ✅ | `isAutomated` check |
| Not flagged inconsistent | ✅ | `automationGuard` |

---

## 5. Orphan Record Analysis

| Scenario | Risk | Mitigation |
|----------|------|-----------|
| Event deleted with teams/submissions | ❌ FK restrict (good) | `ON DELETE RESTRICT` prevents orphaning |
| Team disbanded with active submissions | ⚠️ No cascade logic | Submission `team_id` becomes stale reference |
| Winner record without disbursement | ⚠️ Status stuck at "pending" | No cleanup/timeout mechanism |
| Escrow account without funded event | ⚠️ Possible | If event cancelled before funding, escrow stays `PendingFunding` forever |
| Notification for deleted user | Low | `ON DELETE CASCADE` on users should handle |

---

## 6. Impossible Business Scenarios

| Scenario | Prevented? | Mechanism |
|----------|-----------|-----------|
| Participant and Judge on same event | ✅ | Partial unique index |
| Funding without verified wallet | ⚠️ Partial | Service checks wallet but no DB constraint |
| Disbursement exceeding escrow balance | ✅ | `validatePrizeAllocation` checks on-chain |
| Double disbursement to same winner | ⚠️ Partial | Status filter (`pending`) but no unique constraint |
| Dispute after escrow released | ⚠️ Not enforced | DisputeService doesn't check escrow state |
| Event state regression (e.g., Active → Draft) | ✅ | Workflow engine only defines forward transitions |
| Cancellation of Released escrow | ❌ | `Released` is terminal in escrow state machine |

---

## 7. Concurrent Workflow Handling

| Scenario | Handled? | Mechanism |
|----------|----------|-----------|
| Two users funding same escrow simultaneously | ⚠️ Partial | `version` column exists but not checked in service |
| Parallel disbursement attempts | ✅ | Idempotency key prevents duplicates |
| Concurrent event state transitions | ⚠️ | Version column exists but `WHERE version = ?` not in update |
| Race between dispute filing and prize distribution | ✅ | `unresolvedDisputes > 0` blocks distribution |

---

## 8. Recommendations

### Critical

1. **Align event state model** — Either implement all 16 states in the workflow engine or reduce the DB CHECK to 5 states
2. **Implement missing workflow steps** — Review, WinnerVerification, PrizeApproval, Settlement
3. **Add optimistic concurrency enforcement** — Use `WHERE version = ?` on all mutable resource updates

### High Priority

4. **Wire FinalizationService to event lifecycle** — Rankings finalization should trigger winner creation
5. **Add scheduled reconciliation** — Cron job for funded escrows
6. **Implement escrow cleanup** — Cancel/cleanup PendingFunding escrows for cancelled events
7. **Add disbursement timeout** — If winners don't verify wallets within N days, return funds

### Medium Priority

8. **Remove dead DB states or implement them** — Review, Suspended, JudgingRound2
9. **Add workflow completion tracking** — A per-event progress indicator showing which steps are done
10. **Implement multi-round judging** — Or remove JudgingRound1/Round2 from DB if single-round is the design
