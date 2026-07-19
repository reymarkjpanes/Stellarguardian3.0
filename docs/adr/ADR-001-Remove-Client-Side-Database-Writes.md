# ADR-001: Remove Client-Side Database Writes

**Date:** 2026-07-19  
**Status:** Accepted  

## Context
The current application architecture allows the frontend browser client to mutate data directly in Supabase (e.g., creating events, team members, submitting evaluations) using the `@supabase/supabase-js` client. This bypasses the backend API routing layer.

## Decision
We will completely eliminate client-side database mutations. All data mutations (INSERT, UPDATE, DELETE) must route through the Next.js API Routes (`/api/*`), which will act as the single entry point for validation, authorization, and business logic execution.

## Trade-offs
**Pros:**
- **Security:** Ensures that all authorization rules, role checks, and permission matrices are enforced server-side.
- **Auditability:** Allows the backend to reliably generate audit logs (Who, When, Old Value, New Value, IP).
- **Data Integrity:** Guarantees that state machine transition rules and business logic constraints cannot be bypassed by a compromised or malicious client.
- **Transactionality:** Enables wrapping multi-step processes into server-side database transactions.

**Cons:**
- Increases network latency slightly as requests must hop through the Next.js server before hitting Supabase.
- Requires rewriting existing frontend forms to use `fetch` instead of the Supabase SDK.

## Migration Plan
1. Audit all frontend components (`web/app/(app)/**/*.tsx`) for `supabase.from(...).insert()` and `.update()`.
2. Refactor `event-detail-client.tsx`, `teams/page.tsx`, and `submissions/page.tsx` to call their respective `/api/events/...` endpoints.
3. Update Supabase RLS policies to restrict client-side mutations (revoke INSERT/UPDATE from the `anon` and `authenticated` roles where API usage is required, if using service roles on the backend, or enforce API-only access).

## Risks
- Potential temporary breakage of workflows during the refactor.
- Ensuring the API routes perfectly mirror the expected payloads of the existing client mutations.
