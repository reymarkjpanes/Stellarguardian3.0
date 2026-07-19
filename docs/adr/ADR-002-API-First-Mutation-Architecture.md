# ADR-002: API-First Mutation Architecture

**Date:** 2026-07-19  
**Status:** Accepted  

## Context
The removal of client-side database writes (ADR-001) necessitates a formalized approach to handling data mutations via our backend services. Currently, API endpoints have inconsistent validation and business rule execution.

## Decision
We will adopt an API-First Mutation Architecture where all Next.js Route Handlers (`/api/*`) strictly follow a standardized pipeline before any data is written to Supabase. The frontend will never be trusted to provide valid, sanitized data.

The required pipeline for all endpoints is:
1. **Authentication:** Extract and verify the session/user token.
2. **Authorization:** Check workspace membership, role, and evaluate the specific permission against the requested resource (see ADR-003).
3. **Input Validation:** Use Zod schemas to parse and strictly validate incoming request bodies or query parameters.
4. **Business Rules Execution:** Validate business invariants (e.g., event state checks, team size constraints).
5. **Database Transaction:** Execute the repository operations within a defined transaction boundary (see ADR-004).
6. **Audit Logging:** Append an immutable record of the mutation to the audit log.
7. **Response:** Return a structured payload or standardized error response.

## Trade-offs
**Pros:**
- Complete decoupling of frontend logic from backend data integrity.
- High predictability and consistency in error handling across all mutations.
- Guaranteed generation of audit logs for every state change.

**Cons:**
- Increased boilerplate for creating new endpoints (though manageable via helper middleware/functions).

## Migration Plan
1. Establish standard utility functions for wrapping route handlers in this pipeline.
2. Refactor existing endpoints (e.g., `/api/events`, `/api/teams`) to conform to this standard pipeline.
3. Replace all remaining direct Supabase client calls in frontend components with fetch requests to these standardized endpoints.
