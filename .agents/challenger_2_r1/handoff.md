# Handoff Report — Milestone R1: Organizer Onboarding Flow Verification

**Agent**: `teamwork_preview_challenger_2`  
**Milestone**: R1 (Organizer Onboarding Flow)  
**Date**: 2026-08-01  

---

## 1. Observation

### Code Inspection Observations:
1. **`web/app/(app)/layout.tsx` (Lines 11-13 & 56-60)**:
   ```ts
   const user = await getCurrentUser();
   const displayName = user?.user_metadata?.display_name ?? user?.email ?? "";
   const email = user?.email ?? "";
   ...
   <AppNav
     user={user ? { id: user.id, name: displayName, email } : null}
     workspaces={workspaces}
     currentWorkspaceId={currentWorkspaceId}
   />
   ```
   `AppLayout` derives `displayName` solely from `user?.user_metadata?.display_name`, falling back to `user?.email`. It does **not** query `public.users.display_name`.

2. **`web/app/api/users/me/route.ts` (Lines 89-95)**:
   ```ts
   const { error } = await supabase
     .from("users")
     .upsert({
       id: user.id,
       email: user.email ?? "",
       ...updates,
     });
   ```
   `PATCH /api/users/me` updates the `public.users` database table. It does **not** update `user.user_metadata` in Supabase Auth via `supabase.auth.updateUser()`.

3. **`web/components/layout/app-nav.tsx` (Lines 30-38 & 129)**:
   ```ts
   // Redirect to onboarding if profile is incomplete or user has no workspaces
   useEffect(() => {
     if (
       user &&
       window.location.pathname !== "/onboarding" &&
       (!user.name || user.name === user.email || workspaces.length === 0)
     ) {
       window.location.href = "/onboarding";
     }
   }, [user, workspaces]);
   ```
   Line 129:
   ```tsx
   {user.name.charAt(0).toUpperCase()}
   ```

4. **`web/app/(app)/dashboard/page.tsx` (Lines 39-56)**:
   ```ts
   const [{ data: profile }, { data: rawEventMemberships }, { data: rawWorkspaceMemberships }] =
     await Promise.all([
       supabase.from("users").select("display_name").eq("id", user.id).single(),
       ...
     ]);

   if (
     !profile?.display_name ||
     profile.display_name === user.email ||
     (rawWorkspaceMemberships ?? []).length === 0
   ) {
     redirect("/onboarding");
   }
   ```

5. **`web/app/(app)/onboarding/page.tsx` (Lines 21-33)**:
   ```ts
   const [{ data: profile }, { data: rawWorkspaceMemberships }] = await Promise.all([
     supabase.from("users").select("display_name").eq("id", user.id).single(),
     supabase.from("workspace_members").select("workspace_id").eq("user_id", user.id),
   ]);

   const hasValidDisplayName =
     !!profile?.display_name && profile.display_name !== user.email;
   const hasWorkspaces = (rawWorkspaceMemberships ?? []).length > 0;

   if (hasValidDisplayName && hasWorkspaces) {
     redirect("/dashboard");
   }
   ```

6. **`web/app/(app)/onboarding/onboarding-form.tsx` (Lines 54-91)**:
   ```ts
   const patchRes = await fetch("/api/users/me", { method: "PATCH", ... });
   if (!patchRes.ok) { ... throw new Error(...) }

   const postWsRes = await fetch("/api/workspaces", { method: "POST", ... });
   if (!postWsRes.ok) { ... throw new Error(...) }
   ```

---

## 2. Logic Chain

1. **Infinite Redirect Loop Root Cause**:
   - When an organizer completes onboarding, `onboarding-form.tsx` issues `PATCH /api/users/me` which upserts `display_name` into `public.users`.
   - `PATCH /api/users/me` does **not** update `supabase.auth` `user_metadata`.
   - Upon completing onboarding and navigating to `/dashboard`, the server page (`dashboard/page.tsx`) queries `public.users.display_name`, sees "Alice Organizer", and allows rendering.
   - However, the surrounding layout (`app/(app)/layout.tsx`) fetches `user` via `getCurrentUser()` (`supabase.auth.getUser()`) and reads `user.user_metadata.display_name`.
   - Since `user_metadata.display_name` was never set, `layout.tsx` falls back to `displayName = user.email` and passes `{ name: user.email }` to `AppNav`.
   - On the client side, `AppNav` executes its `useEffect` on `/dashboard`. It compares `user.name === user.email` -> `true`.
   - `AppNav` triggers `window.location.href = "/onboarding"`.
   - On `/onboarding`, `onboarding/page.tsx` checks `public.users.display_name` (which IS "Alice Organizer"), sees onboarding is completed, and server-redirects back to `/dashboard`.
   - This creates an **unrecoverable infinite redirect loop** between `/dashboard` and `/onboarding`.

2. **Uncaught Client UI Crash**:
   - In `AppNav` (line 129), `user.name.charAt(0)` is called during initial JSX rendering before `useEffect` fires.
   - If `user.name` is `null`, `undefined`, or `""`, React throws an unhandled `TypeError: Cannot read properties of null (reading 'charAt')`, causing a white-screen crash.

3. **API Response Resilience Evaluation**:
   - `onboarding-form.tsx` handles network errors, 422 validation errors, and 409 slug conflicts cleanly.
   - Non-JSON errors (such as HTML 502/504 proxy responses) are caught by `.catch(() => ({}))` and fall back gracefully to user-friendly messages.
   - In partial failure scenarios (e.g. `PATCH` succeeds, `POST /api/workspaces` fails), the user remains blocked from app routes until workspace creation succeeds.

---

## 3. Caveats

- Live end-to-end browser execution via Playwright was not performed due to environment command execution constraints, but unit simulation and logic verification harnesses (`.agents/challenger_2_r1/r1-empirical-verification.test.ts`) empirically demonstrate the bug.
- No other caveats.

---

## 4. Conclusion

**Overall Risk Assessment**: **HIGH**

1. **CRITICAL DEFECT**: Infinite redirect loop between `/dashboard` and `/onboarding` caused by data source mismatch between `layout.tsx` (`user_metadata`) and `public.users`.
2. **HIGH DEFECT**: Potential uncaught `TypeError` in `AppNav` when rendering profile initial if `user.name` is null/empty.
3. **API Response Handling**: Verified robust. 4xx/5xx/network errors and non-JSON responses are handled safely without freezing or crashing state.

### Recommended Fixes:
1. In `web/app/(app)/layout.tsx`: Fetch `display_name` from `public.users` table (or update `user_metadata` in `PATCH /api/users/me`), ensuring `layout.tsx` passes the actual database `display_name` to `AppNav`.
2. In `web/components/layout/app-nav.tsx`:
   - Change line 129 to safely handle missing names: `{(user?.name || user?.email || "U").charAt(0).toUpperCase()}`.
   - Replace `window.location.href` with `router.push` for client navigation.

---

## 5. Verification Method

To independently verify these findings:

1. **Inspect Code Files**:
   - `web/app/(app)/layout.tsx` (lines 13, 57)
   - `web/app/api/users/me/route.ts` (lines 89-102)
   - `web/components/layout/app-nav.tsx` (lines 30-38, 129)
   - `web/app/(app)/dashboard/page.tsx` (lines 50-56)
   - `web/app/(app)/onboarding/page.tsx` (lines 26-33)

2. **Run Empirical Harness**:
   - Run Vitest on `.agents/challenger_2_r1/r1-empirical-verification.test.ts`.

3. **Invalidation Condition**:
   - If `layout.tsx` queries `public.users.display_name` (or `PATCH /api/users/me` updates `user_metadata`), then `user.name` will match `public.users.display_name`, breaking the infinite redirect loop condition.
