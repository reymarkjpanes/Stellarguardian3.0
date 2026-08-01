# Technical Analysis: Requirement 1 - Organizer Onboarding Flow

**Author**: `teamwork_preview_explorer_1`  
**Date**: 2026-08-01  
**Project**: Stellar Guardian 3.0  
**Working Directory**: `c:\Users\Reymark\Documents\Antigravity-Project\stellar-guardian-3.0\.agents\teamwork_preview_explorer_1`

---

## 1. Executive Summary & Objective

### Objective
Investigate Requirement 1: Organizer Onboarding Flow in Stellar Guardian 3.0.  
The requirement mandates a dedicated `/onboarding` page that blocks access to `/dashboard` (and protected sub-routes) until the user provides their display name and creates a default workspace.

### Acceptance Criteria
1. **Route Protection & Redirection**: Users without a workspace or display name attempting to access `/dashboard` (or protected sub-routes) must be redirected to `/onboarding`.
2. **Onboarding Form Submission**: Submitting the onboarding form successfully creates a default workspace (with the user as `Owner`), updates the user's `display_name` in the database, and redirects the user to `/dashboard`.

---

## 2. Database Schema & RLS Investigation

### 2.1 Schema Definition
1. **`public.users` Table** (`web/supabase/migrations/20250101000002_users_and_wallets.sql`, lines 8–16):
   - `id`: `uuid primary key references auth.users (id) on delete cascade`
   - `display_name`: `text not null check (char_length(display_name) between 1 and 120)`
   - `email`: `text not null`
   - `deactivated_at`: `timestamptz`

2. **`public.workspaces` Table** (`web/supabase/migrations/20250101000003_workspaces.sql`, lines 5–17):
   - `id`: `uuid primary key default gen_random_uuid()`
   - `slug`: `text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`
   - `name`: `text not null check (char_length(name) between 1 and 200)`
   - `description`: `text check (char_length(description) <= 2000)`

3. **`public.workspace_members` Table** (`web/supabase/migrations/20250101000003_workspaces.sql`, lines 23–28, 38–40):
   - `workspace_id`: `uuid references public.workspaces(id)`
   - `user_id`: `uuid references public.users(id)`
   - `role`: `text check (role in ('Owner', 'Admin', 'Member'))`
   - `primary key (workspace_id, user_id)`
   - Partial unique index `workspace_members_one_owner_per_workspace` on `(workspace_id) WHERE role = 'Owner'`.

### 2.2 RLS Policy Constraints & Critical Discovery
In `web/supabase/migrations/20250101000012_rls_policies.sql`:
- **Line 120–128**: `workspace_members_insert_admin` policy:
  ```sql
  create policy "workspace_members_insert_admin" on public.workspace_members
    for insert with check (
      exists (
        select 1 from public.workspace_members wm2
        where wm2.workspace_id = workspace_id
          and wm2.user_id = (select auth.uid())
          and wm2.role in ('Owner', 'Admin')
      )
    );
  ```
- **Finding**: Direct client-side insertion into `workspace_members` via `@supabase/ssr` or `createBrowserClient()` will fail when creating a new workspace, because the user is not yet an Owner or Admin of the non-existent workspace membership.
- **Solution Requirement**: Workspace creation **must** be executed on the server via `POST /api/workspaces` (`web/app/api/workspaces/route.ts`), which calls the service-role-backed `createWorkspace` function in `web/lib/services/workspace.ts`.

---

## 3. Current Codebase Audit & Gap Analysis

### 3.1 Existing `/onboarding/page.tsx` (`web/app/(app)/onboarding/page.tsx`)
- **Current Behavior**:
  - Checks if `workspace_members` has any entry for `user.id`.
  - On submit, it attempts direct browser client insertion into `workspaces` table without calling `POST /api/workspaces` or creating `workspace_members` membership records or writing audit logs.
  - Updates `auth.users` metadata (`full_name`) via `supabase.auth.updateUser`, but fails to update/upsert `public.users.display_name`.
- **Gaps**:
  - Missing update to `public.users` table (`display_name`).
  - Uses direct client insert on `workspaces` instead of API endpoint `POST /api/workspaces`.
  - Onboarding state check ignores `display_name` validity in `public.users`.

### 3.2 Existing `/dashboard/page.tsx` (`web/app/(app)/dashboard/page.tsx`)
- **Current Behavior** (lines 30–51):
  - Line 36: `if (!user) redirect("/login");`
  - Line 41: `supabase.from("users").select("display_name").eq("id", user.id).single()`
  - Line 47: `supabase.from("workspace_members").select("workspace_id, role").eq("user_id", user.id)`
- **Gaps**:
  - Lacks onboarding verification check. Users without a workspace (`rawWorkspaceMemberships.length === 0`) or without a display name are allowed to stay on `/dashboard` with empty states instead of being redirected to `/onboarding`.

### 3.3 Existing `AppNav` Component (`web/components/layout/app-nav.tsx`)
- **Current Behavior** (lines 29–35):
  - Client-side effect:
    ```tsx
    useEffect(() => {
      if (user && user.name === user.email && window.location.pathname !== "/onboarding") {
        window.location.href = "/onboarding";
      }
    }, [user]);
    ```
- **Gaps**:
  - Only checks `user.name === user.email`. Does not check if user has 0 workspaces (`workspaces.length === 0`).

### 3.4 Existing Next.js Proxy Middleware (`web/proxy.ts`)
- **Current Behavior** (lines 174–204):
  - Validates session claims for non-public routes and redirects unauthenticated users to `/login`.
  - Does not evaluate workspace or display name completeness.

---

## 4. Technical Design & Implementation Strategy

### 4.1 Definition of Onboarded State
A user is considered **Onboarded** if and only if:
1. `display_name` in `public.users` is present, non-empty, and NOT equal to `user.email`.
2. The user belongs to at least one workspace (`workspace_members` count >= 1).

### 4.2 Step-by-Step Fix Strategy

#### Step 1: Enhance `PATCH /api/users/me` & Profile Upsert
In `web/app/api/users/me/route.ts`:
- Ensure `PATCH` performs an `upsert` on `public.users` table using `{ id: user.id, email: user.email, display_name }` to guarantee that user records created via auth flow receive a valid `public.users` row if missing.
- Sync `auth.users` user metadata (`display_name` and `full_name`).

#### Step 2: Implement Complete Submission Flow in `/onboarding/page.tsx`
Update `handleSubmit` in `web/app/(app)/onboarding/page.tsx`:
1. Validate `displayName` (1–120 chars) and `workspaceName` (1–200 chars).
2. Generate valid slug:
   ```ts
   const baseSlug = workspaceName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workspace";
   const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
   ```
3. Call `PATCH /api/users/me` with `{ display_name: displayName }`.
4. Call `POST /api/workspaces` with `{ name: workspaceName, slug }`.
5. Upon successful creation, redirect to `/dashboard` using `window.location.href = "/dashboard"`.

#### Step 3: Enforce Onboarding Guard on `/dashboard` and Protected Routes
In `web/app/(app)/dashboard/page.tsx`:
Right after executing the shell data queries (line 40):
```ts
const hasDisplayName = profile?.display_name && profile.display_name.trim() !== "" && profile.display_name !== user.email;
const hasWorkspace = rawWorkspaceMemberships && rawWorkspaceMemberships.length > 0;

if (!hasDisplayName || !hasWorkspace) {
  redirect("/onboarding");
}
```

In `web/app/(app)/onboarding/page.tsx` (`checkState`):
If the user ALREADY has `hasDisplayName && hasWorkspace`:
```ts
if (hasDisplayName && hasWorkspace) {
  window.location.href = "/dashboard";
}
```

In `web/components/layout/app-nav.tsx`:
Update client-side check:
```ts
useEffect(() => {
  const hasDisplayName = user?.name && user.name.trim() !== "" && user.name !== user.email;
  const hasWorkspace = workspaces && workspaces.length > 0;
  if (user && (!hasDisplayName || !hasWorkspace) && window.location.pathname !== "/onboarding") {
    window.location.href = "/onboarding";
  }
}, [user, workspaces]);
```

---

## 5. Affected Files & Artifacts

| File Path | Action Required | Description |
|---|---|---|
| `web/app/(app)/dashboard/page.tsx` | Modify | Add onboarding state check & redirect to `/onboarding`. |
| `web/app/(app)/onboarding/page.tsx` | Modify | Update state check, display name update via API, workspace creation via `POST /api/workspaces`, redirect to `/dashboard`. |
| `web/components/layout/app-nav.tsx` | Modify | Update client-side navigation check for display name and workspace presence. |
| `web/app/api/users/me/route.ts` | Modify | Use `upsert` on `public.users` table for display name updates. |

---

## 6. Verification & Test Strategy

1. **Unit & Integration Tests**:
   - Verify `POST /api/workspaces` creates workspace, Owner membership in `workspace_members`, and audit record.
   - Verify `PATCH /api/users/me` updates `public.users.display_name`.
2. **E2E Playwright Tests** (`web/e2e/onboarding.spec.ts`):
   - **Test 1**: User without workspace or display name visits `/dashboard` -> redirected to `/onboarding`.
   - **Test 2**: Submitting onboarding form with display name "Test Organizer" and workspace "Test Workspace" creates workspace and redirects to `/dashboard`.
   - **Test 3**: User with existing workspace and display name visits `/onboarding` -> redirected to `/dashboard`.
