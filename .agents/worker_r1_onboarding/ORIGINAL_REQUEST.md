## 2026-08-01T15:20:13Z
Objective:
Implement Requirement 1: Organizer Onboarding Flow in Stellar Guardian 3.0.
Requirements & Specifications:
1. Dedicated `/onboarding` page blocking access to `/dashboard` until display name and default workspace are provided.
2. Acceptance Criteria:
   - Users without a workspace or display name are redirected from `/dashboard` (and protected sub-routes) to `/onboarding`.
   - Submitting the onboarding form successfully creates a workspace, updates display name in `public.users`, and redirects to `/dashboard`.

Code Changes to Make (in `web/`):
1. `web/app/(app)/dashboard/page.tsx`:
   - Inspect user profile display name (`profile?.display_name`) and workspace memberships (`rawWorkspaceMemberships`).
   - If `!profile?.display_name` or `profile.display_name === user.email` or `rawWorkspaceMemberships.length === 0`, server-side `redirect("/onboarding")`.
2. `web/app/(app)/onboarding/page.tsx`:
   - Server check: If user already has a valid `display_name` and `workspaces.length > 0`, `redirect("/dashboard")`.
   - Onboarding Form UI: Allow user to input `displayName` and `workspaceName`.
   - Form Submission:
     a. Call `PATCH /api/users/me` with `{ display_name: displayName }`.
     b. Call `POST /api/workspaces` with `{ name: workspaceName, slug: ... }`.
     c. On success, `router.push("/dashboard")`.
3. `web/components/layout/app-nav.tsx`:
   - Update client-side navigation effect to check both display name validity and workspace membership count.
4. `web/app/api/users/me/route.ts`:
   - Ensure `PATCH` handler upserts/updates `public.users` table (`display_name`) using Supabase client.

Verification:
- Run typecheck: `npm --prefix web run typecheck`
- Run unit/integration tests: `npm --prefix web run test` or `npx vitest`
- Ensure build succeeds.

Deliverables:
- Implement code changes cleanly in `web/`.
- Write `handoff.md` in your working directory with build/test results, observation, logic chain, caveats, conclusion, and verification commands.
- Send completion message to parent (ID: 7739df64-679a-4efb-bee3-42d08a61ccfd).
