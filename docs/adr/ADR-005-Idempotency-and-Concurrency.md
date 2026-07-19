# ADR-005: Idempotency and Optimistic Concurrency Control

**Date:** 2026-07-19  
**Status:** Accepted  

## Context
Currently, only financial operations explicitly manage idempotency. However, other critical operations (e.g., joining a team, submitting an evaluation, state transitions) are vulnerable to duplicate requests due to network retries or rapid double-clicking by users. Furthermore, concurrent modifications (e.g., two judges resolving a dispute simultaneously) can result in race conditions and lost updates.

## Decision
We will standardize Idempotency and Optimistic Concurrency Control across all state-mutating operations.

1. **Idempotency:** 
   - All `POST` requests modifying state must accept an optional `Idempotency-Key` header.
   - The backend will check for the existence of this key in an `idempotency_keys` table before executing the logic.
   - Duplicate requests will return the cached result of the original successful request.
   - This prevents double team joins, duplicate submissions, and duplicate state transitions.

2. **Optimistic Concurrency Control (OCC):**
   - Mutable entities (Events, Disputes, Submissions) must include a `version` integer column.
   - Any `UPDATE` or `PATCH` request must provide the current `version` they expect to modify.
   - The database update clause will append `WHERE id = ? AND version = ?`.
   - If zero rows are affected, it indicates a concurrent modification, and the API will return a `409 ConflictError`, prompting the user to refresh their state.

## Trade-offs
**Pros:**
- Prevents data corruption from race conditions.
- Enhances reliability on unstable networks where clients might retry requests.
- Protects against rapid repeated UI clicks.

**Cons:**
- Requires frontend clients to track and pass version numbers for mutable records.
- Adds slight complexity to database update statements.

## Migration Plan
1. Ensure `version` columns exist on all heavily mutated tables and default to 1.
2. Update frontend data fetching to extract the `version` and append it to mutation payloads.
3. Implement a centralized idempotency middleware/utility for API routes.
