# 7. Implement Interface-Based Domain Event Bus

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
