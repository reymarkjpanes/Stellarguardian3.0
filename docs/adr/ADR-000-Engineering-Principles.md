# ADR-000: Engineering Principles

**Date:** 2026-07-19  
**Status:** Accepted  

## Context
As Stellar Guardian 3.0 scales to support trustless blockchain-backed event management, the underlying architecture must be secure, resilient, and highly auditable. To prevent the accumulation of technical debt—such as business logic bleeding into the UI—we must define foundational engineering principles that all future code and Architecture Decision Records (ADRs) must follow.

## Decision
We adopt the following non-negotiable Engineering Principles for the Stellar Guardian platform:

1. **API First:** The UI is merely a client. All mutations, business logic, and integrations are exposed solely via the API layer.
2. **Domain-Driven Design (DDD):** Business logic is encapsulated in a Domain layer containing aggregates (Event, Team, Submission, Escrow, Winner). It is isolated from API transport and Database persistence.
3. **No Client Database Mutations:** The frontend UI must never directly write to the database (Supabase). All database access for mutations flows through the Next.js backend.
4. **Business Logic Never Lives in UI:** Frontend components are responsible only for state presentation and user interaction.
5. **Event-Driven Side Effects:** Core transactions publish Domain Events (e.g., `EventCreated`). Subsystems (Audit, Notification, Webhooks) subscribe to these events instead of blocking the main thread.
6. **Secure by Default:** Every API endpoint validates Authentication, Workspace Membership, Role, and granular Permissions before execution.
7. **Test Before Merge:** Code is supported by a Testing Pyramid (Unit, Integration, Contract, E2E) and is not merged without corresponding tests.
8. **SOLID, DRY, KISS, YAGNI:** Standard software engineering principles apply. Keep it simple, do not repeat yourself, ensure single responsibility, and you aren't gonna need it (don't over-engineer).
9. **Feature First:** Features are built around user domains rather than technical layers.

## Architecture Guardrails
To enforce these principles, the following guardrails are strictly observed:
- UI never writes directly to the database.
- Only API routes can mutate state.
- Application Services cannot import UI code.
- Repositories contain no business logic, only data access.
- Database triggers never replace business rules.
- Every mutation generates an immutable audit event.
- Every API endpoint requires input validation (Zod) and authorization.

## Trade-offs
**Pros:** 
- Highly consistent architecture.
- New engineers can onboard quickly with clear boundaries.
- Prevents the exact technical debt (client-side bypasses) currently found in the system.

**Cons:** 
- Higher upfront boilerplate required to implement the Application Service and Domain layers compared to simple CRUD.

## Migration Plan
All subsequent ADRs (ADR-001 through ADR-006) directly implement these principles. Phase 1 (Platform Integrity & Security Foundation) will systematically refactor the existing codebase to comply with these rules.
