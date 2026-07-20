# 10. Standardize Request Context

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
