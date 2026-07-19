# Migration Plan

Because Stellar Guardian 3.0 handles financial escrows and high-stakes event states, architectural migrations must be executed with extreme caution to prevent data loss or workflow interruption.

## Core Migration Principles
1. **Never Break Production:** Existing workflows must remain functional until the new implementation is fully verified.
2. **Double Write / Dual Path:** When replacing critical data paths, both paths may run in parallel (if idempotent) or be toggled via feature flags.
3. **API-First Refactoring:** Backend logic is migrated and tested before frontend consumption changes.

## Standard Migration Strategy Template
Every task in **Phase 1 (Platform Integrity & Security Foundation)** must follow this sequence:

### 1. Current State Documentation
Identify the exact component, file, or endpoint being replaced. Document the existing behavior, side effects, and permissions.

### 2. Implementation Steps
1. **Build:** Develop the new API endpoint, Application Service, or Repository function.
2. **Test:** Write Unit and Integration tests verifying the new backend implementation.
3. **Feature Flag:** Wrap the frontend UI call in a feature flag (e.g., `if (USE_NEW_API)`).
4. **Switch Frontend:** Deploy the frontend pointing to the new API path.

### 3. Verification & Observability
- Monitor structured logs and Sentry for errors specific to the new endpoint.
- Verify that Audit Logs are correctly capturing the new mutations.
- Ensure the database state matches expectations.

### 4. Rollback Plan
- If errors exceed acceptable thresholds (e.g., >1% failure rate), immediately toggle the feature flag back to the legacy client-side mutation path.
- Database rollbacks (if necessary) are documented via down-migrations in Supabase.

### 5. Completion Criteria (Definition of Done)
- The new API handles 100% of the traffic.
- The feature flag is removed.
- The legacy client-side mutation code (e.g., `supabase.from('...').insert()`) is completely deleted from the codebase.
- Tests are passing on the `main` branch.

## Specific Migration: Client-Side Database Writes
**Target:** `event-detail-client.tsx`, `teams/page.tsx`, `submissions/page.tsx`.
**Strategy:**
- Create `/api/events`, `/api/teams`, `/api/submissions` ensuring they respect the Authorization Matrix.
- Update UI components to use standard `fetch` or `SWR`/`React Query` mutations instead of `@supabase/supabase-js`.
- Revoke `INSERT` and `UPDATE` grants for the `authenticated` role in Supabase RLS policies for these tables to ensure no future client bypasses can occur.
