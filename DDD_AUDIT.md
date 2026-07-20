# DDD Audit — StellarGuardian 3.0

## 1. Domain Model Assessment

### Aggregate Roots Identified

| Aggregate Root | Location | Properly Modeled? |
|----------------|----------|-------------------|
| Team | `src/domains/teams/domain/Team.ts` | ✅ Entity with invariants, methods, policies |
| Submission | `src/domains/submissions/domain/` | ✅ State machine, validation service |
| Evaluation | `src/domains/judging/domain/EvaluationAggregate.ts` | ✅ Aggregate with state machine |
| PrizeAllocationBatch | `src/domains/prizes/domain/PrizeAllocationBatch.ts` | ✅ Aggregate root for allocations |
| RankingEngine | `src/domains/rankings/domain/RankingEngine.ts` | ⚠️ Service, not aggregate (no identity) |
| EscrowAccount | `lib/repositories/escrow.repository.ts` | ❌ No aggregate — raw DB operations |
| Event | `lib/engines/workflow/event-workflow.ts` | ❌ No aggregate — just a workflow engine |
| Workspace | None | ❌ No domain model exists |
| User | None | ❌ No domain model (only Supabase auth) |
| Dispute | `lib/state-machine/dispute.ts` | ❌ State machine only, no aggregate |

### Missing Aggregate Roots

1. **Event** — Should be an aggregate owning its lifecycle state, members, team constraints, and escrow relationship
2. **Workspace** — Should own workspace members, settings, feature flags, billing
3. **Dispute** — Should encapsulate evidence, resolution, and filer relationships
4. **Notification** — Should manage delivery status, read state, preferences

---

## 2. Value Objects Assessment

### Implemented Value Objects

| Value Object | Location | Validation |
|-------------|----------|-----------|
| `StellarPublicKey` | `types/common.ts` (Zod regex `^G[A-Z2-7]{55}$`) | ✅ |
| `Amount` | `types/common.ts` (numeric ≥ 0) | ✅ |
| `UUID` | `types/common.ts` (uuid format) | ✅ |
| `NetworkMode` | `types/enums.ts` (testnet/mainnet) | ✅ |
| `PlatformRole` | `types/enums.ts` (10 values) | ✅ |
| `EventState` | `types/enums.ts` (5 values — mismatch!) | ⚠️ |
| `EscrowState` | `types/enums.ts` (9 values) | ✅ |
| `DisputeState` | `types/enums.ts` (5 values) | ✅ |

### Missing Value Objects

1. **Money** — Amount + currency pair (critical for financial domain)
2. **TransactionHash** — Should be a proper VO with validation (not just string)
3. **WalletAddress** — Should be a VO distinct from StellarPublicKey (future multi-chain)
4. **TimeWindow** — Start/end with elapsed() method (for review windows, registration deadlines)
5. **Score** — Normalized value between 0-100 with weighting logic
6. **Slug** — URL-safe identifier with uniqueness semantics

---

## 3. Domain Services Assessment

### Properly Separated Domain Services

| Service | Domain Logic | Infrastructure Dependency |
|---------|-------------|--------------------------|
| `EventBusinessRules` | ✅ Pure precondition checks | None (pure) |
| `EventWorkflowEngine` | ✅ Transition validation | None (pure) |
| `canEscrowTransition` | ✅ Pure state machine | None (pure) |
| `canDisputeTransition` | ✅ Pure state machine | None (pure) |
| `ScoreCalculator` (judging) | ✅ Calculation logic | None (pure) |
| `WeightedAverageStrategy` (rankings) | ✅ Strategy pattern | None (pure) |
| `TeamSearchSpecification` (teams) | ✅ Specification pattern | None (pure) |

### Improperly Coupled Domain Services

| Service | Issue |
|---------|-------|
| `FundingService` | Directly creates Supabase client — should receive a repository |
| `DisbursementService` | Combines blockchain, notification, and persistence in one class |
| `RefundService` | Same issue — hardcoded infrastructure |
| `VerificationService` | Mixes reconciliation logic with Supabase queries |

---

## 4. Application Services Assessment

### `src/domains/` Layer (Well-Structured)

```
teams/application/
  commands/
    CreateTeamCommand.ts
    JoinTeamCommand.ts
    LeaveTeamCommand.ts
  queries/
    GetTeamQuery.ts
    ListTeamsQuery.ts

submissions/application/
  commands/
    CreateSubmissionCommand.ts
    SubmitCommand.ts
  queries/
    GetSubmissionQuery.ts
```

✅ Proper CQRS separation with single-responsibility handlers.

### `lib/` Layer (Monolithic Services)

```
lib/services/escrow/
  funding.service.ts      — createEscrowAccount + verifyFunding (mixed concerns)
  disbursement.service.ts — validate + execute + notify (orchestration overload)
  refund.service.ts       — retry logic + state management + notification
  verification.service.ts — reconcile + public verification (two use cases in one)
```

❌ Each service handles multiple use cases rather than one command/query per handler.

---

## 5. Bounded Context Relationships

### Context Map

```
┌─────────────────┐    owns     ┌──────────────┐
│   Workspace     │────────────>│    Event     │
└─────────────────┘             └──────────────┘
                                       │
            ┌──────────────────────────┼───────────────────────┐
            │              │           │           │            │
            v              v           v           v            v
     ┌──────────┐   ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐
     │  Teams   │   │Submission│ │ Judging │ │Rankings│ │  Prizes │
     └──────────┘   └──────────┘ └─────────┘ └────────┘ └─────────┘
                                                              │
                                                              v
                                                        ┌──────────┐
                                                        │  Escrow  │
                                                        └──────────┘
                                                              │
                                                     ┌────────┼────────┐
                                                     v        v        v
                                              ┌─────────┐┌────────┐┌────────┐
                                              │ Funding ││Disburse││ Refund │
                                              └─────────┘└────────┘└────────┘
```

### Relationship Types

| Upstream | Downstream | Type | Status |
|----------|-----------|------|--------|
| Workspace → Event | Conformist | ⚠️ workspace_id FK only, no anti-corruption layer |
| Event → Teams | Partnership | ✅ Team constraints enforced via event configuration |
| Event → Submissions | Partnership | ✅ Submission lifecycle respects event state |
| Submissions → Judging | Customer-Supplier | ✅ Judging domain queries submissions |
| Judging → Rankings | Customer-Supplier | ✅ Rankings consume evaluation scores |
| Rankings → Prizes | Customer-Supplier | ✅ Prize allocation uses rankings |
| Prizes → Escrow | Partnership | ✅ Prize batch referenced by escrow |
| Event → Disputes | Partnership | ⚠️ Loose coupling via event_id only |

### Missing Anti-Corruption Layers

1. **Workspace ↔ Event** — Event creation should validate workspace-level policies (team size defaults, KYC, feature flags) through an ACL
2. **Rankings → Prizes** — Prize allocation should not directly reference ranking internals
3. **External Blockchain → Escrow** — The `StellarChainAdapter` serves as an ACL ✅ (good)

---

## 6. Domain Events Assessment

### Published Events (Found in Code)

| Event | Published By | Consumed By |
|-------|-------------|-------------|
| `FundingCompleted` | `FundingService` | Unknown (no registered handlers) |
| `PrizeReleased` | `DisbursementService` | Unknown |
| `EventCreated` | Type defined but not published anywhere | — |

### Issues

1. 🔴 **Events are published but no subscribers are registered** — The `eventBus` in `lib/domain/events.ts` has `subscribe()` method but no code calls it. The comment says "we will add more event types and register subscribers here or in a separate bootstrapper" — this was never done.
2. 🟠 **`publishDomainEvent`** in `lib/events/publisher.ts` is a separate pathway from the `eventBus` — two competing event systems.
3. 🟡 **No event schemas** — Domain events are untyped `T = any`.

---

## 7. Repository Implementation Quality

### Teams (Best Example)
```
src/domains/teams/domain/repositories/TeamRepository.ts  → Interface (port)
src/domains/teams/infrastructure/PostgresTeamRepository.ts → Adapter
```
✅ Proper dependency inversion, testable with mocks.

### Escrow (Needs Work)
```
lib/repositories/escrow.repository.ts → Static methods + hardcoded Supabase
```
❌ No interface, no DI, untestable without real DB.

---

## 8. Recommendations

### Priority 1: Resolve State Model Divergence
- Align `EventStateSchema` in Zod with the 16 states in the DB CHECK constraint
- Implement the full 16-state event lifecycle state machine in `lib/state-machine/event.ts`

### Priority 2: Complete Domain Event Infrastructure
- Register event subscribers in an application bootstrapper
- Implement outbox pattern for reliable event delivery
- Type domain events with discriminated unions

### Priority 3: Migrate Remaining Contexts to `src/domains/`
- Events, Workspace, Disputes need proper aggregate roots
- Extract Money value object for all financial calculations
- Add anti-corruption layers at context boundaries

### Priority 4: Dependency Injection
- Introduce a simple DI container or factory pattern
- All services should receive repositories as constructor arguments
- This unlocks unit testing without real infrastructure
