# ADR-003: Authorization Pipeline and Permission Matrix

**Date:** 2026-07-19  
**Status:** Accepted  

## Context
Authorization checks are currently scattered across API routes, and some administrative pages (like `/admin`) only verify authentication, lacking proper role-based gating. We need a centralized, deterministic way to verify permissions before allowing business operations.

## Decision
We will implement a rigorous, centralized Authorization Pipeline based on a formal Permission Matrix. Every API route and protected Server Component will execute this check immediately after verifying authentication.

The matrix will define permissions explicitly based on the user's role within a workspace (e.g., Participant, Judge, Mentor, Organizer, Workspace Admin, Platform Admin).

Example matrix:
- **Create Event:** Organizer, Workspace Admin, Platform Admin
- **Publish Event:** Organizer, Workspace Admin, Platform Admin
- **View Audit Logs:** Organizer, Workspace Admin, Platform Admin
- **Submit Evaluation:** Judge

## Trade-offs
**Pros:**
- Prevents Insecure Direct Object Reference (IDOR) and privilege escalation vulnerabilities.
- Centralized logic allows for easy auditing and updates to role definitions.
- Frontend UI can dynamically render or hide elements based on querying the same permission matrix.

**Cons:**
- Requires careful mapping of every possible action in the system to a specific role.
- Adds slight database query overhead to verify workspace membership/roles on every protected request.

## Migration Plan
1. Define the complete matrix in a shared configuration file (e.g., `web/lib/permissions.ts`).
2. Create an authorization middleware or helper function `requirePermission(user, resource, action)`.
3. Audit all existing API endpoints and inject `requirePermission()` before business logic execution.
4. Protect the `/admin` route and other privileged UI routes using Server Components that invoke the role check.
