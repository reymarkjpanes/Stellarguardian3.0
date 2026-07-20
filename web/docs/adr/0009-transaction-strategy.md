# 9. Implement Unit of Work and Outbox Pattern

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
