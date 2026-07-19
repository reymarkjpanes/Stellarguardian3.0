# ADR-004: Database Transaction Boundaries

**Date:** 2026-07-19  
**Status:** Accepted  

## Context
Complex business operations (e.g., creating an event) currently execute multiple independent database inserts or updates sequentially. If one step fails (e.g., creating the escrow account fails after the event is created), the database is left in a partially complete, inconsistent state.

## Decision
We will enforce explicit Database Transaction Boundaries for all multi-step mutations. An operation must either succeed completely or fail completely, rolling back all intermediate changes. 

For complex workflows like Event Creation, the transaction must encompass:
1. Creating the Event record.
2. Creating the initial Escrow record.
3. Creating default Milestones.
4. Appending the Audit Log entry.

Because Supabase Data API (PostgREST) does not support wrapping multiple discrete HTTP requests into a single database transaction, we will implement these transactional boundaries using **Supabase RPC (Remote Procedure Calls)** via PostgreSQL stored procedures, or by leveraging Prisma/Drizzle transactions if an ORM is introduced later. For now, critical workflows will be encapsulated in SQL functions.

## Trade-offs
**Pros:**
- Complete protection against partial failure states and corrupted data.
- Ensures absolute atomicity, consistency, isolation, and durability (ACID) for complex domains.

**Cons:**
- Requires writing business logic or data mapping in PostgreSQL PL/pgSQL functions for transaction encapsulation, which splits logic between Next.js and the database.

## Migration Plan
1. Identify all multi-step mutation endpoints (Event Creation, Escrow Funding, State Transitions).
2. Create Supabase migrations defining RPC functions that wrap these multi-step inserts in `BEGIN ... COMMIT` blocks.
3. Update the API route handlers to call `supabase.rpc('function_name', { ...args })` instead of sequential `.insert()` statements.
