# Architecture Audit — StellarGuardian 3.0

## 1. High-Level Architecture Assessment

### Intended Architecture
- Next.js App Router (single deployable artifact)
- Clean Architecture with DDD bounded contexts
- CQRS (separate read/write paths)
- Repository Pattern
- Service Layer
- Event-driven (Domain Event Bus)
- State Machines (pure, no I/O)

### Actual Implementation

The codebase has **two coexisting architectural layers**:

| Layer | Location | Pattern | Maturity |
|-------|----------|---------|----------|
| A (Original) | `web/lib/` | Service-oriented, flat | 70% complete |
| B (Emerging) | `web/src/domains/` | DDD/Hexagonal | 40% complete |

This dual architecture is the single largest architectural risk.

---

## 2. Clean Architecture Compliance

### Violations Found

| Violation | Location | Severity |
|-----------|----------|----------|
| `FundingService` directly imports `createServiceClient` (infra → domain coupling) | `lib/services/escrow/funding.service.ts` | 🟠 High |
| `EscrowRepository` imports `createServiceClient` inside the repo (should be injected) | `lib/repositories/escrow.repository.ts` | 🟡 Medium |
| `DisbursementService` imports notification + audit directly (cross-cutting concern leaked) | `lib/services/escrow/disbursement.service.ts` | 🟡 Medium |
| `PermissionEngine` has no interface — consumers are coupled to the concrete class | `lib/engines/permission/` | 🟡 Medium |
| Event Workflow Engine imports from Business Rules (fine) but also coupled to specific EventState from types | `lib/engines/workflow/` | 🟢 Low |

### Positive Findings

- ✅ State machines are pure (no I/O) — importable by both server and client
- ✅ `server-only` imports prevent client-side leakage of sensitive modules
- ✅ Zod schemas in `/types` as single source of truth (Req 1.5) — well executed
- ✅ API handler wrapper (`apiHandler`) standardizes auth/validation/error handling
- ✅ Typed error hierarchy (`AppError`) with canonical envelope responses
- ✅ Three Supabase client factories with proper separation of concerns

### Layer Dependency Compliance

| Rule | Status | Evidence |
|------|--------|----------|
| UI never imports repositories | ✅ Pass | No imports of `lib/repositories` in `app/` or `components/` |
| Domain never imports React | ✅ Pass | State machines, domain models have zero React imports |
| Domain never imports Next.js | ✅ Pass | State machines are pure TypeScript |
| Repositories never contain business logic | ⚠️ Partial | `EscrowRepository.fundEscrow()` delegates to RPC — logic is in Postgres function |
| Application layer orchestrates use cases | ✅ Pass | Services compose repository + domain + notifications |
| Infrastructure implements interfaces | ❌ Fail | `lib/` services hardcode `createServiceClient()` — no DI |

---

## 3. DDD Boundaries Assessment

### Bounded Contexts (Intended vs. Implemented)

| Context | Design Doc | `lib/` Layer | `src/domains/` Layer |
|---------|-----------|-------------|---------------------|
| Workspace | ✅ | Partial (no service) | ❌ Missing |
| Users | ✅ | Partial (auth only) | ❌ Missing |
| Events | ✅ | State machine + workflow engine | ❌ Missing |
| Teams | ✅ | `lib/repositories/team.repository.ts` | ✅ Full DDD (Team entity, policies, repos) |
| Submissions | ✅ | `lib/services/__tests__/` | ✅ Full DDD (StateMachine, CQRS) |
| Judging | ✅ | `lib/services/judging/` | ✅ Full DDD (Aggregate, StateMachine, ScoreCalc) |
| Rankings | ✅ | ❌ Missing | ✅ Full DDD (RankingEngine, strategies) |
| Prizes | ✅ | ❌ Missing | ✅ Full DDD (PrizeAllocation, Batch, Events) |
| Escrow | ✅ | ✅ Complete (Funding, Disbursement, Refund, Verification) | ✅ Partial (adapters) |
| Disputes | ✅ | State machine + service | ❌ Missing |
| Notifications | ✅ | `lib/services/notification.ts` | ❌ Missing |
| Audit | ✅ | `lib/services/audit.ts` | ❌ Missing |

**Assessment**: 5/12 bounded contexts have proper DDD implementation in `src/domains/`. The rest live in the flat `lib/` layer.

---

## 4. CQRS Assessment

| Domain | Commands | Queries | Separation |
|--------|----------|---------|-----------|
| Teams (`src/domains/teams/`) | ✅ `application/commands/` | ✅ `application/queries/` | ✅ Full CQRS |
| Submissions (`src/domains/submissions/`) | ✅ `application/commands/` | ✅ `application/queries/` | ✅ Full CQRS |
| Networking (`src/domains/networking/`) | ✅ `application/commands/` | ✅ `application/queries/` | ✅ Full CQRS |
| Members (`src/domains/members/`) | ❌ | ✅ `application/queries/` | Partial (read-only) |
| Escrow (`lib/`) | Mixed in services | Mixed in services | ❌ No separation |
| Events (`lib/`) | Mixed in route handlers | Mixed in route handlers | ❌ No separation |

---

## 5. Repository Pattern Assessment

### `src/domains/` Layer (Proper Implementation)
- `teams/domain/repositories/TeamRepository.ts` — Interface (port)
- `teams/infrastructure/PostgresTeamRepository.ts` — Implementation (adapter)
- Clean dependency inversion ✅

### `lib/` Layer (Service-Repository Hybrid)
- `lib/repositories/escrow.repository.ts` — Static methods, hardcoded Supabase client
- `lib/repositories/event.repository.ts` — Same pattern
- No interfaces defined — consumers are coupled to concrete implementations ❌

---

## 6. Event Bus & Domain Events

### Implementation
```typescript
// lib/domain/events.ts
class DomainEventBus {
  async publish(eventName, payload) {
    // Fire all handlers asynchronously (non-blocking)
    Promise.allSettled(handlers.map(h => h(payload))); // NOT awaited!
  }
}
```

### Issues
1. 🔴 **`publish()` does not await `Promise.allSettled`** — handlers fire-and-forget with no error propagation to the caller
2. 🟠 **No outbox pattern** — events are not persisted before publishing; if the process crashes between DB write and event publish, the event is lost
3. 🟠 **No dead letter queue** — failed handlers are only `console.error`'d
4. 🟡 **In-memory bus** — events don't survive process restarts; not suitable for multi-instance deployments

---

## 7. State Machine Architecture

### Strengths
- Pure functions (no I/O) — testable, shareable between client/server ✅
- Graph-based with per-edge precondition arrays ✅
- Consistent `TransitionResult` shape across all three lifecycles ✅
- Property-based tests with fast-check ✅
- Terminal state detection ✅

### Issues
1. 🔴 **State enum divergence**: DB CHECK constraint has 18 states, Zod `EventStateSchema` has 5 states (Draft/Active/Completed/Cancelled/Archived), design doc specifies 16. The code will accept DB records that fail Zod validation.
2. 🟠 **No event lifecycle state machine in `lib/state-machine/`** — only `escrow.ts` and `dispute.ts` exist. The event workflow engine (`lib/engines/workflow/`) uses the simplified 5-state model, not the 16-state design.
3. 🟡 **Missing rollback transitions** — design specifies `ROLLBACK_TRANSITIONS` map but it's not implemented.

---

## 8. Optimistic Concurrency

- ✅ `version` column on `events`, `escrow_accounts`, `teams`, `submissions`, `winners`
- ✅ Schema alignment migration adds version columns
- ❌ **Route handlers do not pass `version` in WHERE clause for updates** — the version column exists but isn't consistently checked at the application layer
- ❌ **No `VersionConflictError`** in the typed error hierarchy

---

## 9. Module Isolation

| Concern | Isolated? | Evidence |
|---------|-----------|----------|
| Auth from Business Logic | ✅ Yes | Middleware handles auth; services assume authenticated context |
| Financial from Non-Financial | ⚠️ Partial | `lib/services/escrow/` is separate but notification leaks in |
| Blockchain from Domain | ✅ Yes | `lib/stellar/client.ts` implements `ChainAdapter` interface |
| Database from Domain | ⚠️ Partial | `src/domains/` uses repos; `lib/` hardcodes Supabase |
| UI from Business Logic | ✅ Yes | Server Components delegate to services |

---

## 10. Recommendations

1. **Complete the migration to `src/domains/`** — Move events, workspace, disputes, notifications, and audit into proper bounded contexts with interfaces.
2. **Resolve state enum divergence** — Align DB CHECK, Zod schema, and workflow engine on the 16-state lifecycle from the design doc.
3. **Implement Dependency Injection** — Replace hardcoded `createServiceClient()` calls with injected repository interfaces.
4. **Add outbox pattern** — Persist domain events transactionally alongside DB writes, then publish asynchronously.
5. **Wire optimistic concurrency** — Add `version` to API request bodies and use `WHERE version = $expected` on all mutable resource updates.
6. **Await the event bus** — At minimum, `await Promise.allSettled()` so handler failures are logged at the call-site.
