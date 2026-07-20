import os

adrs = {
    "docs/adr/0006-postgres-js.md": """# 6. Use postgres.js for Server-Side Transactions

Date: 2026-07-20

## Status
Accepted

## Context
Supabase JS client uses PostgREST, which does not support multi-statement interactive transactions. This makes workflows like CreateTeam (insert team, insert captain, insert outbox event) fragile. We need true ACID guarantees.

## Decision
We will use `postgres.js` explicitly for server-side repositories to execute interactive transactions using the connection pool. We will restrict its use to trusted environments (Next.js Node API, background jobs) and keep the Supabase JS client for Auth, Storage, and Realtime.

## Consequences
- Better data integrity for complex workflows.
- Connection pooling requires careful management.
- Hard boundary established: no postgres.js in React components or Edge runtimes.
""",
    "docs/adr/0007-event-bus.md": """# 7. Implement Interface-Based Domain Event Bus

Date: 2026-07-20

## Status
Accepted

## Context
Domain Services were directly calling Activity/Notification services, resulting in tight coupling and violation of the Single Responsibility Principle.

## Decision
We will introduce an `EventPublisher` interface. Domain Services will only publish events (`TeamCreated`, `InvitationAccepted`). Side effects will be handled by asynchronous or decoupled event subscribers.

## Consequences
- Adding new side effects (e.g., sending an email) requires zero changes to the Domain Service.
- Event handlers are isolated and can fail independently if implemented asynchronously.
""",
    "docs/adr/0008-team-aggregate.md": """# 8. Introduce Aggregate Roots

Date: 2026-07-20

## Status
Accepted

## Context
Business rules and validations were scattered across Domain Services. `TeamService` acted as a "god class" containing all data validation and orchestration logic.

## Decision
We will apply Aggregate Roots from Domain-Driven Design. A `Team` class will encapsulate team-related data (members, max size, status) and expose operations like `acceptJoinRequest()`. The Aggregate Root is the sole guardian of its invariants.

## Consequences
- Business logic is heavily unit-testable without mocking a database.
- Prevents invalid states at the code level before they reach the repository.
""",
    "docs/adr/0009-transaction-strategy.md": """# 9. Implement Unit of Work and Outbox Pattern

Date: 2026-07-20

## Status
Accepted

## Context
Writing to multiple tables (e.g., creating a team and logging an activity) without transactions risks partial failures. Furthermore, publishing domain events directly over HTTP from within a transaction can lead to "dual write" issues if the external system succeeds but the DB transaction rolls back.

## Decision
We will wrap Use Cases in a `UnitOfWork` using `postgres.js`. We will implement the Transactional Outbox pattern: domain events will be saved to an `outbox_events` table within the same transaction. A separate process/worker will read the outbox and dispatch to the `EventPublisher`.

## Consequences
- Zero lost events.
- Guaranteed atomicity across database mutations.
- Slight increase in architectural complexity (requires an outbox worker).
""",
    "docs/adr/0010-request-context.md": """# 10. Standardize Request Context

Date: 2026-07-20

## Status
Accepted

## Context
Logging, auditing, and multi-tenancy requirements demand that contextual data (user ID, IP, correlation ID, timestamp) be available deep in the service and repository layers. Passing these manually to every function is tedious and error-prone.

## Decision
We will introduce a standardized `RequestContext` object containing `user`, `requestId`, `correlationId`, `traceId`, `ip`, and other metadata. This context will be passed down from the API layer to all Use Cases and Repositories.

## Consequences
- Ensures all logs and outbox events have tracing headers.
- Simplifies dependency injection for request-scoped data.
"""
}

for path, content in adrs.items():
    with open(path, "w") as f:
        f.write(content)

print("ADRs created.")
