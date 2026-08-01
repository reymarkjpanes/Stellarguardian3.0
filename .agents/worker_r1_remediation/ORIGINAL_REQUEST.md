## 2026-08-01T07:27:27Z
<USER_REQUEST>
You are teamwork_preview_worker for Milestone R1 Onboarding Remediation.
Your working directory is: c:\Users\Reymark\Documents\Antigravity-Project\stellar-guardian-3.0\.agents\worker_r1_remediation

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Objective:
Fix the critical infinite redirect loop and null-pointer crash in Milestone R1 Onboarding identified by Challenger 2.

Defects to Fix:
1. **Critical Infinite Redirect Loop (`web/app/(app)/layout.tsx` & `web/app/api/users/me/route.ts`)**:
   - In `web/app/(app)/layout.tsx`: Fetch `display_name` from `public.users` table for `user.id` (matching `dashboard/page.tsx`) so `layout.tsx` passes the actual database `display_name` to `<AppNav />`.
   - In `web/app/api/users/me/route.ts`: In the `PATCH` handler, also call `supabase.auth.updateUser({ data: { display_name } })` (or set metadata) so Supabase Auth user metadata stays synchronized with `public.users.display_name`.
2. **Uncaught Client UI Crash (`web/components/layout/app-nav.tsx`)**:
   - In `web/components/layout/app-nav.tsx` line 129: Replace unsafe `user.name.charAt(0)` with null-safe fallback: `{(user?.name || user?.email || "U").charAt(0).toUpperCase()}`.

Verification:
- Run typecheck: `npm --prefix web run typecheck`
- Run unit tests: `npm --prefix web run test -- lib/__tests__/onboarding.test.ts lib/__tests__/r1-onboarding-tier1-2.test.ts`

Deliverables:
- Apply clean code fixes in `web/app/(app)/layout.tsx`, `web/app/api/users/me/route.ts`, and `web/components/layout/app-nav.tsx`.
- Write `handoff.md` in your working directory.
- Send completion message to parent (ID: 7739df64-679a-4efb-bee3-42d08a61ccfd).
</USER_REQUEST>
