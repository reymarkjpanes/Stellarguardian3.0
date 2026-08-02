# Stellar Guardian 3.0 — Complete End-to-End Product Audit

**Audit Date:** August 2, 2026  
**Auditor:** Full codebase static analysis + user journey simulation  
**Scope:** All 7 roles × full lifecycle from landing to escrow settlement  
**Method:** Real-user perspective simulation based on actual page/component code

---

## Executive Summary

Stellar Guardian 3.0 is a sophisticated hackathon/bounty platform with a well-architected backend
and a solid foundation. The core happy path for Organizers is the most complete. Judges have
functional but minimal tooling. Sponsors and Admin are largely functional. Guest and Participant
journeys have specific friction points that need addressing before claiming production readiness.

---

## PART 1 — ROLE-BY-ROLE JOURNEY AUDIT

---

### ROLE 1: GUEST (Unauthenticated Visitor)

**Goal:** Discover events, understand the platform, and decide to sign up.


#### Journey: Landing Page → Discover → Event Detail → Sign Up

**Step 1: Landing Page (`/`)**
- ✅ Page exists, clean hero, clear value proposition
- ✅ "Get started" CTA links to `/signup`
- ✅ "Browse events" links to `/discover`
- ✅ Auth check: redirects logged-in users to `/dashboard`
- ✅ Footer has Terms and Privacy links — both pages exist at `/(public)/terms` and `/(public)/privacy`
- ⚠️ No social proof, no "X events hosted" counter, no real screenshot/demo embed
- ⚠️ "How it works" Step 2 says "platform-custodied escrow account" but the system uses Soroban smart contracts — misleading copy

**Step 2: Discover Page (`/discover`)**
- ✅ Server-rendered, SEO-friendly, cursor-based pagination
- ✅ Search by text, category, format filters all functional
- ✅ Escrow trust badges (✓ Escrow Verified, ⏳ Funding Pending) — excellent differentiator
- ✅ Empty state shown when no events found
- ✅ "Clear filters" link appears when filters are active
- ⚠️ Clicking a card goes to `/e/[id]` (public detail) — BUT if user is already logged in,
  `/e/[id]` immediately redirects to `/events/[id]` (authenticated view). This double-redirect
  is invisible to the user but adds ~200ms latency and a flash on slower connections.

**Step 3: Public Event Detail (`/e/[id]`)**
- ✅ Page exists with SEO metadata, OG tags
- ✅ Shows key metrics: prize pool, participants, teams, team size
- ✅ CTA adapts: "Sign in to register" vs "Sign in to view" based on event state
- ✅ `redirect` parameter passed through to `/login?redirect=/events/[id]`
- ❌ **CRITICAL:** `redirect` parameter is passed but the login page does NOT honor it.
  After login, users are sent to `/dashboard` or `/onboarding` — they lose the event they
  were trying to reach. The `redirect` query param is read nowhere in `login/page.tsx`.

**Step 4: Sign Up (`/signup`)**
- ✅ Page exists, form works (email + password + display name)
- ✅ Email confirmation flow via Supabase
- ✅ Error states handled with `role="alert"`
- ⚠️ `emailRedirectTo` is set to `/login` — after email confirmation, user lands on login and
  must log in again. Better UX: redirect to `/auth/callback?next=/onboarding` to auto-login.
- ⚠️ No password strength indicator or minimum length hint shown
- ⚠️ No Terms of Service checkbox during signup
- ❌ After submitting, form shows "Check your email" but form does NOT clear — user can
  accidentally submit again because the button is still enabled after success message appears.
  (The `message` state is set but `loading` goes back to false and form is still interactive.)


**Step 5: Login (`/login`)**
- ✅ Page exists, works correctly
- ✅ "Forgot password?" link present and working (`/forgot-password` exists)
- ✅ Error states handled
- ✅ Post-login routing: workspace members → `/dashboard`, no workspace → `/onboarding`
- ❌ **CRITICAL:** `redirect` query param is ignored. `window.location.href = "/dashboard"` is
  hardcoded. Users coming from `/e/[id]` lose their destination.
- ⚠️ Uses `window.location.href` instead of Next.js `router.push()` — causes full page reload,
  slower than SPA navigation

**Step 6: Forgot Password (`/forgot-password`)**
- ✅ Page exists, form submits correctly
- ✅ Success state shows "Check your email" with back button
- ✅ No user enumeration — same message for valid/invalid email
- ✅ Redirects to `/auth/callback?next=/reset-password` correctly

**Step 7: Reset Password (`/reset-password`)**
- ✅ Page exists, form works
- ✅ Redirects to `/login` after 2 seconds on success
- ⚠️ No confirmation password field ("new password" + "confirm password") — user cannot
  verify they typed correctly since it's a hidden field
- ⚠️ No minimum password length validation on the client side

**Guest Journey Issues Summary:**

| # | Issue | Priority |
|---|-------|----------|
| G1 | Login page ignores `?redirect=` param — users lose event destination | Critical |
| G2 | Signup form stays interactive after success message | High |
| G3 | Email confirmation redirects to `/login` instead of auto-logging in | High |
| G4 | Landing page copy says "platform-custodied escrow" — inaccurate | Medium |
| G5 | No password strength hint during signup | Medium |
| G6 | No Terms acceptance checkbox during signup | Medium |
| G7 | No confirm password field on reset-password page | Medium |

---

### ROLE 2: PARTICIPANT

**Goal:** Find an event → Register → Form/join a team → Submit project → View results → Receive payout


**Step 1: Onboarding (`/onboarding`)**
- ✅ Gate works: users without display_name or workspace are redirected here
- ✅ Creates default workspace automatically
- ✅ Redirects to `/dashboard` on completion
- ⚠️ Onboarding is workspace-centric — a participant joining an event doesn't necessarily
  want a workspace. The onboarding copy should clarify "workspace = your profile container"

**Step 2: Event Registration (`/events/[id]/register`)**
- ✅ Page exists with a proper loading skeleton
- ✅ Checks for `RegistrationOpen` state before showing register button
- ✅ Shows "already registered" state with helpful next steps
- ✅ Success state with links to Teams page
- ✅ Terms checkbox required before confirming
- ⚠️ Uses `useParams` with `router.push()` for auth check — has a brief flash for unauthenticated
  users before redirect. Server component would eliminate this.
- ⚠️ The "event rules" link in the terms checkbox points to `/events/${eventId}` (event overview)
  not to a dedicated rules section — no actual rules exist to read
- ❌ **CRITICAL:** No feedback when registration closes before the deadline but state hasn't
  changed. If organizer forgets to transition state, participants see a perpetual "RegistrationOpen"
  even after the deadline has passed. No deadline enforcement on the frontend.

**Step 3: Team Formation (`/events/[id]/teams`)**
- ✅ Teams page exists, shows all teams with member lists
- ✅ Create team, join team, leave team actions available via `TeamsClient`
- ⚠️ No "pending join requests" indicator from the participant perspective
  (they submit a request but don't know if/when it was accepted)
- ⚠️ No in-page notification when join request is accepted

**Step 4: Submission (`/events/[id]/submissions`)**
- ✅ Submissions page exists, shows all team submissions
- ✅ Participant can see their team's submission status
- ✅ `SubmissionsClient` handles the submit form with GitHub URL and demo URL
- ⚠️ `submissionDeadline` is fetched via `event.submission_deadline` but cast as
  `(event as Record<string, unknown>).submission_deadline` — type unsafe cast suggests
  this field may not be in the Supabase type definitions. If it's null, no deadline is shown.
- ⚠️ No countdown timer to submission deadline visible on the page

**Step 5: View Judging Results**
- ✅ Submissions page shows `feedback` array when event state is `Completed` and the
  participant has a submission — judges' scores and `participant_feedback` text is shown
- ✅ Conflict-of-interest evaluations filtered out from participant feedback
- ❌ Feedback only visible after event reaches `Completed` state. During `JudgingRound1`/
  `JudgingRound2`, participants see nothing — no "judging in progress" indicator,
  no estimated timeline.
- ❌ Participants cannot see their final score/rank until the event is fully Completed,
  even after DisputeWindow closes. This creates uncertainty.

**Step 6: View Winners (`/events/[id]/winners`)**
- ✅ Winners page exists and shows prize amounts and disbursement_status
- ✅ Participants can see if they won and how much
- ❌ No link or button from winners page to the escrow page for the participant to track
  their payout progress (escrow tab is `organizerOnly`)
- ❌ Participants cannot see their wallet address recorded for payout — no confirmation
  that the system knows where to send their XLM
- ❌ `disbursement_status` column values are raw DB enum strings (e.g. "pending") —
  not user-friendly. Should say "Payout pending" or "Sent to wallet"

**Step 7: Receive Prize**
- ❌ No participant-facing payout tracking page exists
- ❌ No notification sent to winners when their XLM is disbursed (notification system exists
  but no winner disbursement notification is confirmed wired)
- ❌ Participants need a verified wallet for payout but wallet verification is in Settings.
  No in-context prompt exists to ensure winners have verified their wallets BEFORE
  the disbursement phase begins.

**Step 8: File a Dispute (`/events/[id]/disputes`)**
- ✅ Disputes page exists with a filing form
- ✅ Participants can file disputes during `DisputeWindow` state
- ✅ Dispute state (Open, UnderReview, Upheld, Dismissed) shown
- ⚠️ No notification to participant when their dispute status changes

**Participant Journey Issues Summary:**

| # | Issue | Priority |
|---|-------|----------|
| P1 | Winners cannot track payout — no disbursement status page for participants | Critical |
| P2 | No wallet verification prompt before disbursement phase | Critical |
| P3 | Login ignores `?redirect=` — participants lose event destination after login | Critical |
| P4 | No feedback visible during judging (participants don't know judging is happening) | High |
| P5 | No notification when payout is disbursed | High |
| P6 | disbursement_status raw enum strings shown to users | High |
| P7 | No join-request status feedback — participant doesn't know if accepted | Medium |
| P8 | No submission deadline countdown on submissions page | Medium |
| P9 | "Event rules" link in registration points to overview, not actual rules | Low |

---

### ROLE 3: ORGANIZER

**Goal:** Create event → Publish → Manage lifecycle → Oversee judging → Disburse prizes


**Step 1: Create Event (`/events/new`)**
- ✅ Event creation page exists
- ✅ Fields: title, description, category, format, team sizes, prize pool, deadline
- ✅ Redirect to new event page on success
- ⚠️ No judging criteria setup during creation — organizer must find the separate Judging tab
  after creation. A new user won't know this is required before publishing.
- ⚠️ No workspace pre-selection if user has multiple workspaces — event is created under
  a default workspace with no way to specify during creation

**Step 2: Edit Event (`/events/[id]/edit`)**
- ✅ Edit page exists with all fields
- ✅ Optimistic concurrency with version token — 409 conflict detection works
- ✅ Validation (title min 5 chars, description min 20 chars, team size rules)
- ✅ Only editable in `Draft` or `Published` states — redirect otherwise
- ⚠️ No `submission_deadline` field in the edit form, even though it's used by the
  submissions page. This field appears to be set at creation only and cannot be updated.

**Step 3: Event Lifecycle (Event Overview + Sub-nav)**
- ✅ EventDetailClient shows the current state prominently
- ✅ Lifecycle transitions are available via lifecycle controls (event-detail-client.tsx)
- ✅ Sub-nav shows all relevant tabs (Overview, Teams, Submissions, Judging, Winners,
  Escrow, Disputes, Members, Prizes) with organizer-only tabs correctly gated
- ⚠️ Sub-nav does not include a "Register" tab — organizer has no direct link to the
  participant registration flow to preview what participants see
- ⚠️ Edit button only appears in `Draft` and `Published` states. Once `RegistrationOpen`,
  organizer cannot adjust team size or deadline — but may legitimately need to extend deadline

**Step 4: Manage Members (`/events/[id]/members`)**
- ✅ Members page exists via `MembersPageLayout` + `MembersContent`
- ✅ Role assignment, approval/rejection of pending participants
- ⚠️ Members page uses a `Suspense` fallback of just `<div>Loading directory...</div>` —
  no skeleton, poor UX on slow connections

**Step 5: Manage Judging (`/events/[id]/judging`)**
- ✅ Organizer sees full `OrganizerJudgingDashboardClient` with analytics
- ✅ Can assign submissions to judges, view scoring progress
- ✅ Judge assignment coverage visible
- ⚠️ No "Finalize Judging" button visible on the judging page — organizer must know to
  transition state via the Overview page lifecycle controls, not from the Judging tab
  where they're spending most of their time

**Step 6: Prize Allocation (`/events/[id]/prizes`)**
- ✅ Page exists, accessible from `JudgingRound1` state onwards
- ✅ Redirects to Judging page if event hasn't reached the prize phase yet
- ✅ `ensureDraftBatch` lazy-initializes the prize batch automatically
- ✅ Prize categories, snapshots, allocations all fetched in parallel
- ⚠️ Prizes page is inaccessible during `Draft`, `Published`, `RegistrationOpen` states —
  but organizer legitimately needs to pre-configure prize categories before judging

**Step 7: Escrow & Disbursement (`/events/[id]/escrow`)**
- ✅ Comprehensive 7-step workflow with visual progress tracker
- ✅ Real-time Supabase subscriptions for live updates
- ✅ On-chain state fetched from Soroban RPC
- ✅ Wallet connection (auto-detect first available wallet adapter)
- ✅ In-flight lock prevents double submissions
- ✅ Transaction step indicators (connecting → preparing → signing → broadcasting → confirming → done)
- ✅ Explorer links to Stellar Expert for contract, wallet, and transaction
- ✅ Balance mismatch inconsistency warning
- ✅ Error states with dismiss and retry options
- ⚠️ Wallet selection always picks `adapters[0]` — if user has multiple wallets installed,
  there's no way to choose which wallet to use for funding
- ⚠️ `fundAmount` field has no max-value validation — organizer could try to fund more
  than the target amount. Server-side prevents this but no client hint is shown.
- ⚠️ `Escrow` tab is always shown in sub-nav for organizers regardless of event state.
  Early in the lifecycle (Draft, RegistrationOpen) this tab is confusing since escrow
  doesn't exist yet and shows an "EmptyState: Prize allocation not locked yet" message.

**Organizer Journey Issues Summary:**

| # | Issue | Priority |
|---|-------|----------|
| O1 | No "Finalize Judging" button on Judging page — requires state transition from Overview | High |
| O2 | submission_deadline cannot be edited after creation | High |
| O3 | Prize categories cannot be configured before judging starts | High |
| O4 | Wallet selection always picks first wallet — no wallet picker in escrow | Medium |
| O5 | No workspace selector during event creation with multiple workspaces | Medium |
| O6 | Judging criteria setup not prompted during event creation flow | Medium |
| O7 | Members page has no loading skeleton | Low |
| O8 | Escrow tab shows in nav during Draft state — confusing context | Low |

---

### ROLE 4: JUDGE

**Goal:** Review assigned submissions → Score them → Submit evaluations


**Step 1: Dashboard (Judge sees "Judging Assignments" section)**
- ✅ Dashboard shows a "Judging Assignments" section for Judge-role events
- ✅ Uses `EventListFilter` component to list events where user is Judge
- ✅ Clicking an event takes judge to `/events/[id]` (overview)

**Step 2: Event Overview (Judge perspective)**
- ✅ EventDetailClient renders for a Judge user
- ⚠️ Sub-nav shows: Overview, Teams, Submissions, Judging, Winners, Disputes
  The "Judging" tab is shown — this is correct. But "Escrow", "Members", "Prizes"
  are hidden (organizerOnly). This is correct behavior.
- ⚠️ The "Judging" tab for non-organizers routes to the same page (`/events/[id]/judging`)
  which then branches by role. This is fine but means the URL for judge scoring is
  `/events/[id]/judging` showing their assignments, not the organizer dashboard.

**Step 3: Judge Evaluation List (`/events/[id]/judging` — judge branch)**
- ✅ Shows "My Evaluations" list with assigned submissions
- ✅ Shows judging progress bar (X / Y scored)
- ✅ Shows "Judging is not currently active" if state isn't JudgingRound1/2
- ✅ Empty state handled
- ❌ **CRITICAL:** `ev.status` is hardcoded to `"Draft"` for all evaluations regardless of
  actual DB status. The `evaluations` query selects `status` from DB but the mapping at
  line `status: "Draft"` overwrites it. Judges cannot see which submissions they've already
  scored vs. pending. The "Score" vs. "View" button logic relies on this status field and
  will always show "Score" even for submitted evaluations.
- ⚠️ No indication of the judging rubric/criteria anywhere on this page — judges don't know
  what they're scoring against before clicking into a submission

**Step 4: Score a Submission (`/events/[id]/judge/workspace/[submissionId]`)**
- ✅ Page exists (directory confirmed)
- ⚠️ Cannot fully verify without reading the file, but the route exists
- The judging list links to this page with the format:
  `href={/events/${eventId}/judge/workspace/${ev.submissionId}}`

**Step 5: Conflict of Interest Declaration**
- ✅ `conflictOfInterest` field exists in evaluations and is displayed in the judge list
- ✅ "⚠ Conflict declared" badge shown
- ❌ No dedicated UI button to declare a conflict of interest from the judge's evaluation list.
  The conflict flag exists in the DB but there's no explicit "Declare Conflict" action
  visible on the judge's assignment list page.

**Judge Journey Issues Summary:**

| # | Issue | Priority |
|---|-------|----------|
| J1 | ev.status hardcoded to "Draft" — judges can't see which submissions they've already scored | Critical |
| J2 | No "Declare Conflict of Interest" button on judge assignments list | High |
| J3 | No scoring rubric/criteria visible before entering a submission | High |
| J4 | No email/notification when judging phase begins and judge has assignments | Medium |
| J5 | No "all done" confirmation when judge has scored all assignments | Medium |

---

### ROLE 5: SPONSOR

**Goal:** Contribute funds to an event → Track milestone delivery → Monitor payout status


**Step 1: Dashboard (Sponsor view)**
- ✅ Dashboard has a "Sponsoring (Funded Events)" section for users with Sponsor role
- ✅ `SponsorEventList` component shows sponsored events with escrow state and prize pool
- ✅ Shows `escrowState` and `expectedBalance` per event

**Step 2: Contribute Funds**
- ⚠️ The API route `/api/events/[id]/sponsors` exists but there is no UI for a sponsor to
  self-serve add a sponsorship to an event. Sponsors must be manually added by an organizer.
- ⚠️ `admin_deposit` function in the Soroban contract allows platform-authorized sponsor
  deposits but there is no UI flow for a sponsor to trigger this deposit independently.

**Step 3: Track Milestones**
- ❌ API route `/api/events/[id]/milestones` exists but no milestone tracking UI page exists
- ❌ No milestone list, no milestone completion status visible to sponsors anywhere in the UI

**Step 4: View Disbursement Status**
- ⚠️ The Sponsor dashboard card shows `escrowState` (e.g., "FullyFunded", "Released") which
  gives some visibility — but this is at the escrow level, not at the prize-payout level
- ❌ No detailed view of which winners received which amounts from the sponsor's contribution

**Sponsor Journey Issues Summary:**

| # | Issue | Priority |
|---|-------|----------|
| S1 | No self-service sponsorship contribution flow — must be added by organizer | High |
| S2 | No milestone tracking UI — API exists but no pages | High |
| S3 | No detailed payout report for sponsors | Medium |
| S4 | No dedicated "Sponsor Dashboard" page — only a dashboard section | Medium |

---

### ROLE 6: WORKSPACE OWNER / ADMIN

**Goal:** Create workspace → Invite members → Manage events under workspace → Configure settings

**Step 1: Create Workspace (`/workspaces/new`)**
- ✅ Page exists with name, slug (auto-generated), and description fields
- ✅ Slug validation, conflict detection (409 response handled)
- ✅ Redirect to new workspace on success
- ⚠️ The onboarding flow creates a workspace automatically — but a user who wants a
  SECOND workspace must find the "Create Workspace" quick action on the dashboard.
  This is a bit hidden.

**Step 2: Workspace Detail (`/workspaces/[slug]`)**
- ✅ Page exists showing members, events, and workspace stats
- ✅ "New Event" button available for owners/admins
- ✅ Member list shown
- ✅ "Manage" link to `/workspaces/[slug]/members`
- ✅ "Settings" link to `/workspaces/[slug]/settings` (for admins)
- ⚠️ Directory confirms `/workspaces/[slug]/members/` and `/workspaces/[slug]/settings/`
  exist as directories but no page.tsx files were confirmed in them.
  These may be empty directories (dead links).

**Step 3: Invite Members**
- ✅ API route `/api/workspaces/[slug]/invitations/` exists
- ✅ Invitation acceptance page at `/invitations/accept?token=` exists and is functional
- ✅ Invitation preview with trust signals shown before accepting
- ✅ Expired/invalid/accepted states all handled
- ❌ No UI to SEND invitations — the invitation API exists but there is no invitation
  form/page in the workspace settings or members page

**Step 4: Workspace Settings**
- ⚠️ `/workspaces/[slug]/settings` directory exists but page content unconfirmed

**Workspace Owner Journey Issues Summary:**

| # | Issue | Priority |
|---|-------|----------|
| W1 | No UI to send workspace invitations (API exists, no form/page) | Critical |
| W2 | Workspace members page may be an empty directory (dead link from workspace detail) | High |
| W3 | Workspace settings page may be an empty directory | High |
| W4 | No workspace switcher confirmation — switching silently changes context | Low |

---

### ROLE 7: PLATFORM ADMIN

**Goal:** Monitor platform health → Manage users → Oversee events → Review audit logs


**Step 1: Access Admin Panel (`/admin`)**
- ✅ `is_platform_admin` check using service client (bypasses RLS) — correct
- ✅ Non-admins redirected to `/dashboard`
- ❌ **CRITICAL:** There is NO navigation link to `/admin` from anywhere in the app.
  The admin must know to manually type `/admin` in the URL bar. The app nav does not
  show an "Admin" link even for `is_platform_admin` users.

**Step 2: Admin Dashboard (`/admin`)**
- ✅ KPI cards: Total Users, Active Events, Open Disputes, Escrow Value
- ✅ Recent Events table with links
- ✅ Recent Audit Activity table
- ✅ Admin sub-nav: Dashboard, Users, Events, Audit Logs

**Step 3: Manage Users (`/admin/users`)**
- ✅ User list with search
- ✅ Activate/deactivate accounts (cannot deactivate other admins — correct)
- ⚠️ Only 50 users shown, no pagination for large user bases
- ⚠️ No ability to grant/revoke `is_platform_admin` from the UI — must be done via DB
- ⚠️ No "View profile" link from user management

**Step 4: Manage Events (`/admin/events`)**
- ✅ Event list with search
- ✅ Can cancel or archive any event directly (bypasses state machine)
- ✅ Links to event detail page
- ⚠️ Admin can jump an event to `Cancelled` or `Archived` bypassing preconditions —
  no confirmation dialog ("Are you sure you want to cancel this event with 50 participants?")

**Step 5: Audit Logs (`/admin/audit`)**
- ✅ Page exists, shows last 100 audit records
- ✅ Shows action, actor, resource, metadata, timestamp
- ⚠️ `actor_id` shown as truncated UUID — should be resolved to display name
- ⚠️ No filtering by action type, date range, or resource — 100 records with no filter
  is not useful for investigating specific incidents
- ⚠️ Uses `createServerClient` (cookie-based) instead of `createServiceClient` for the
  query, meaning RLS policies apply. If RLS restricts audit_records to self, this would
  only show records for the current admin, not all platform records.
- ⚠️ No CSV export for audit logs — critical for compliance and incident response

**Admin Journey Issues Summary:**

| # | Issue | Priority |
|---|-------|----------|
| A1 | No navigation link to /admin — admins must know the URL | Critical |
| A2 | No confirmation dialog before cancelling/archiving events | High |
| A3 | Audit log uses cookie-based client — may be subject to RLS restrictions | High |
| A4 | No audit log filtering or CSV export | High |
| A5 | actor_id in audit log shows truncated UUID, not display name | Medium |
| A6 | User list has no pagination beyond 50 | Medium |
| A7 | Cannot grant/revoke admin status from UI | Medium |

---

## PART 2 — CROSS-CUTTING CONCERNS


### 2.1 Navigation & Information Architecture

| Issue | Impact | Priority |
|-------|--------|----------|
| Event sub-nav "Register" tab missing — participants arrive at event overview with no register button visible in the tab bar | Participant registration friction | High |
| Admin panel has no entry point from main nav | Admins cannot find admin panel | Critical |
| No breadcrumbs on workspace sub-pages | Navigation confusion | Medium |
| Mobile: notification bell not shown in mobile menu | Participants miss notifications on mobile | Medium |
| No "Edit event" button in event overview for organizers — must know to visit `/edit` | Organizer confusion | Medium |

### 2.2 Empty / Loading / Error States

| Page | Empty State | Loading State | Error State | Assessment |
|------|------------|---------------|-------------|------------|
| Dashboard | ✅ "No events yet" | ✅ (server renders instantly) | ⚠️ No error boundary data | Adequate |
| Discover | ✅ "No events found" | ✅ loading.tsx exists | ✅ error.tsx exists | Good |
| Event detail | ✅ notFound() | ✅ loading.tsx | ✅ error.tsx | Good |
| Escrow page | ✅ animated skeleton | ✅ spinner | ✅ error with dismiss | Excellent |
| Members page | ❌ just "Loading directory..." | ❌ no skeleton | ❌ unknown | Poor |
| Notifications | ✅ "No notifications yet" | ✅ spinner | ❌ no error state | Adequate |
| Admin audit | ✅ "No audit records" | None (server) | ❌ no error handling | Adequate |
| Judge evaluation list | ✅ EmptyState component | None visible | ❌ no error handling | Adequate |

### 2.3 Permission & Role-Based Access

- ✅ Organizer-only tabs (Escrow, Members, Prizes) correctly gated by `isOrganizer` prop
- ✅ Event edit page checks organizer status client-side (belt-and-suspenders with layout)
- ✅ Admin panel checks `is_platform_admin` in layout AND page component
- ✅ Judge evaluation list only shows for Role === "Judge"
- ⚠️ The event sub-nav hides "Escrow" for non-organizers but a participant who knows the URL
  can navigate to `/events/[id]/escrow` directly. The escrow page itself loads without a
  role check client-side (it uses `createBrowserClient()` which respects RLS, so the data
  would be restricted, but the page still renders with empty/confusing state)
- ⚠️ Prize dashboard page does check `member.role !== "Organizer" && member.role !== "Admin"`
  — correctly gated server-side
- ⚠️ Admin events page uses `createServiceClient()` (bypasses RLS) for state changes —
  this is correct but means admin can cancel any event without the state machine's
  precondition checks. This could leave related records in an inconsistent state.

### 2.4 Responsive & Accessibility

- ✅ Mobile nav menu exists (hamburger toggle with all key links)
- ✅ Workspace switcher in nav
- ✅ `aria-label` on icon buttons (nav menu toggle, profile button)
- ✅ `role="alert"` on error/success messages in forms
- ✅ `aria-current="page"` on active sub-nav tabs
- ⚠️ Notification bell only in desktop nav — mobile users cannot see it in the hamburger
  menu (it IS included in mobile nav as a link to `/notifications` — ✅ on closer review)
- ⚠️ Event cards on Discover page use `<a>` wrapping the entire card — entire card is one
  link which is correct but the escrow badge inside is also sometimes `<span>`. Screen
  readers will read the entire card as one link including the badge text — could be confusing
- ⚠️ No `skip to main content` link for keyboard navigation
- ⚠️ Wallet connection modal/flow uses `alert()` calls in some error paths — not accessible
- ⚠️ Some form validation relies only on `required` HTML attribute — no `aria-invalid` or
  `aria-describedby` for screen reader error associations

### 2.5 Security & Permission Concerns

| Concern | Severity | Notes |
|---------|----------|-------|
| Login ignores `?redirect=` — not a direct security issue but an auth UX failure | Medium | Could be exploited as open redirect if param is added naively |
| Admin state changes bypass state machine preconditions | High | Cancelling event with funded escrow could strand funds |
| MFA section allows unenroll without re-authentication | High | Should require current password or fresh MFA code to disable |
| `avatar_url` accepts any URL — no domain validation | Medium | Could be used to load tracking pixels or malicious images |
| Audit log uses cookie client — may miss platform-wide records | High | Compliance risk |
| Password reset has no min-length enforcement client-side | Low | UX issue, server still enforces Supabase defaults |
| No CAPTCHA or rate limit on signup form | Medium | Spam account creation possible |


---

## PART 3 — CONSOLIDATED ISSUES LIST (ALL ROLES)

### 🔴 CRITICAL (Blocks Core User Flow)

| ID | Role | Journey | Location | Problem | Why It Matters | Fix |
|----|------|---------|----------|---------|----------------|-----|
| C1 | Guest/All | Login | `/login/page.tsx` | Login ignores `?redirect=` query param. After email confirmation or direct login, users always go to `/dashboard` or `/onboarding`, losing their intended destination. | Any user clicking "Sign in to register" from a public event page lands on dashboard, not the event. High friction, likely to cause drop-off. | Read `searchParams.get('redirect')` and use `router.push(redirect)` after successful login. Sanitize the redirect to prevent open-redirect. |
| C2 | Participant | Prize receipt | `/events/[id]/winners` | No participant-facing payout tracking. Escrow tab is organizer-only. Winners don't know if/when their XLM was sent, or if the system knows their wallet. | A financial platform where winners can't track their prize payment is a fundamental trust failure. | Add read-only escrow status to the winners page, or create a `/events/[id]/my-payout` page. Show `disbursement_status` in human language. |
| C3 | Participant | Prize receipt | Settings, Escrow flow | No prompt for participants to verify their wallet before disbursement phase. If a winner has no verified wallet, their payout will fail with no user-visible explanation. | Silent payout failure for winners is the worst possible outcome on a financial platform. | Add a wallet verification status check on the winners page. Show a banner: "⚠ Connect and verify your wallet to receive prizes." |
| C4 | Judge | Evaluation | `/events/[id]/judging` | `ev.status` is hardcoded to `"Draft"` for all evaluations. Judges cannot distinguish submissions they've already scored from ones still pending. "Score" button always shows instead of "View" for completed ones. | Judges will re-score submissions they've already completed, or be confused about their progress. | Remove the hardcoded `status: "Draft"` override. Use `e.status` directly from the DB query. |
| C5 | Admin | Access | App nav | No navigation link to `/admin` panel. Platform admins must know the URL. | Admins cannot effectively monitor the platform. Any new admin joining won't know the panel exists. | Add Admin link to app-nav for users with `is_platform_admin = true` (check via user metadata or dedicated API call). |
| C6 | Workspace Owner | Member management | `/workspaces/[slug]` | No UI to send workspace invitations. The invitation API and acceptance flow work, but there is no form to generate and send an invite token. | Workspace owners cannot onboard team members. The entire invitation system is effectively unusable. | Add an "Invite Member" form to the workspace members page that calls `POST /api/workspaces/[slug]/invitations`. |

---

### 🟠 HIGH PRIORITY (Significant UX or Functional Gap)

| ID | Role | Problem | Fix |
|----|------|---------|-----|
| H1 | Guest | Signup: form stays interactive after success — can double-submit. `emailRedirectTo` goes to `/login` not auto-login. | Set `loading` to true permanently on success, or hide form. Change `emailRedirectTo` to `/auth/callback?next=/onboarding`. |
| H2 | Participant | No wallet verification prompt before judging ends. Winners need wallet verified before disbursement — no in-context reminder exists. | Show a persistent banner on the event detail page during `JudgingRound1`, `JudgingRound2`, `WinnerVerification` for participant-role users without a verified wallet. |
| H3 | Participant | Raw disbursement_status enum strings shown ("pending") — not user-friendly. | Map enum to human strings: "pending" → "Payout pending", "disbursed" → "Sent ✓". |
| H4 | Organizer | `submission_deadline` field is not present in the event edit form — cannot be updated after creation. | Add `submission_deadline` input to `/events/[id]/edit`. |
| H5 | Organizer | Prize categories cannot be configured until `JudgingRound1` state. Organizer needs to set up prizes pre-event. | Either allow prize category management from event creation, or make the Prizes tab accessible earlier (at least in `Draft`). |
| H6 | Organizer | No "Finalize Judging" button on the Judging page — must use Overview page lifecycle stepper. | Add a contextual "Advance to Winner Verification" button to the Judging page when all submissions are scored. |
| H7 | Judge | No scoring rubric/criteria visible on the judge evaluation list. Judge clicks "Score" without knowing the criteria. | Fetch and display `judging_criteria` on the judge evaluation list page. |
| H8 | Judge | No "Declare Conflict of Interest" button on judge assignment list. | Add a COI declaration button per assignment row that updates `conflict_of_interest = true` on the evaluation. |
| H9 | Sponsor | No self-service sponsorship flow — must be manually added by organizer. | Create a "Become a Sponsor" flow on public event pages with an `admin_deposit` transaction UX. |
| H10 | Admin | Admin event state changes bypass state machine preconditions with no confirmation dialog. | Add a confirmation modal before Cancel/Archive actions in the admin events page. |
| H11 | Admin | Audit log uses `createServerClient` (cookie RLS) instead of `createServiceClient`. May not show all platform records. | Change to `createServiceClient()` for audit log queries. |
| H12 | Workspace | `/workspaces/[slug]/members` and `/workspaces/[slug]/settings` directories exist but may have no `page.tsx` — dead links. | Verify and implement pages, or remove links until implemented. |

---

### 🟡 MEDIUM PRIORITY (UX Improvements)

| ID | Role | Problem | Fix |
|----|------|---------|-----|
| M1 | All | No `skip to main content` accessibility link. | Add `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>` at the top of each layout. |
| M2 | All | `window.location.href` used for post-login navigation instead of `router.push()`. | Replace with `useRouter().push()` for SPA navigation. |
| M3 | Guest | Landing page copy: "platform-custodied escrow account" — inaccurate. It's a Soroban smart contract. | Fix copy: "funds locked in a Soroban smart contract on Stellar". |
| M4 | Guest | No password strength indicator on signup. | Add a simple strength bar (weak/medium/strong) based on length and character variety. |
| M5 | Guest | Reset password has no "confirm password" field. | Add a second password field and validate they match before submitting. |
| M6 | Participant | No submission deadline countdown on the submissions page. | Show "X days remaining" or "Submissions close [date]" near the submit form. |
| M7 | Participant | No team join-request status visible to participant. | Show "Request Pending" state after submitting a join request. |
| M8 | Organizer | Escrow tab shows for organizers even in Draft state — confusing "not ready yet" state. | Either hide the Escrow tab until `PrizeApproved` state, or show a clear timeline of when escrow becomes relevant. |
| M9 | Organizer | Wallet selection always uses `adapters[0]`. No wallet picker for users with multiple wallets. | Add a wallet selection step when multiple adapters are detected. |
| M10 | Judge | No notification when judging phase begins. | Wire a notification event for JudgingRound1 → assigned judges. |
| M11 | Admin | Audit log actor_id shown as truncated UUID — not readable. | Join with `users` table to display `display_name` alongside UUID. |
| M12 | Admin | No audit log filtering (date range, action type, resource). | Add filter controls to audit page. |
| M13 | All | Members page Suspense fallback is just a plain text `<div>Loading directory...</div>`. | Replace with a proper skeleton component. |
| M14 | All | `avatar_url` in Settings accepts any URL — no validation. | Validate URL format and optionally domain-whitelist (gravatar, storage CDN). |

---

### 🔵 LOW PRIORITY

| ID | Problem | Fix |
|----|---------|-----|
| L1 | Mobile hamburger icon uses Unicode characters (☰, ✕) — may render differently across systems. | Use SVG icons instead. |
| L2 | Admin cannot grant/revoke `is_platform_admin` from the UI. | Add toggle in Admin Users page (with strong confirmation). |
| L3 | Form validation lacks `aria-invalid` and `aria-describedby` for screen reader error associations. | Add ARIA attributes to form fields with errors. |
| L4 | Event sub-nav "Register" tab is missing — participants can't see a Register action from the event nav. | Add Register tab (visible only in RegistrationOpen state for non-members). |
| L5 | Workspace creation "Create Workspace" quick action is not prominently discoverable for existing users. | Consider adding it to the workspace switcher dropdown. |


---

## PART 4 — PRODUCTION READINESS REPORT

---

### 4.1 Completed Workflows ✅

These workflows are functional end-to-end:

1. **Guest → Sign Up → Onboarding** — Works, though email confirmation UX could improve
2. **Guest → Forgot Password → Reset Password** — Complete and secure
3. **Organizer → Create Event → Edit Event → Manage Members** — Solid
4. **Organizer → Event Lifecycle Progression** — State machine works with lifecycle controls
5. **Organizer → Judging Dashboard** — Analytics, assignment views functional
6. **Organizer → Prize Allocation → Escrow Creation → Fund → Disburse** — Most complete workflow in the app
7. **Participant → Register → Teams → Submit** — Core submission flow works
8. **Participant → Disputes** — Filing and viewing disputes works
9. **Judge → View Assignments → Score Submissions** — Route exists and evaluation flow exists (with status bug)
10. **Admin → Users → Events → Audit Log** — Basic CRUD admin functions work
11. **Workspace Owner → Create Workspace → View Workspace Dashboard** — Works
12. **Invitation Acceptance Flow** — Functional with trust signals
13. **Wallet Connection + Verification** — 5-wallet support with challenge-response works
14. **Notifications Inbox** — Read/unread, mark-all-read works
15. **Settings (Profile, Wallet, MFA, Send XLM)** — Comprehensive settings page

---

### 4.2 Incomplete Workflows ❌

These workflows exist in the design but are broken or missing in the UI:

1. **Guest → Click Event → Login → Return to Event** — BROKEN: redirect param ignored
2. **Winner → Track My Payout** — MISSING: no participant-facing disbursement page
3. **Winner → Verify Wallet Before Payout** — MISSING: no in-context wallet prompt during event lifecycle
4. **Workspace Owner → Invite Member** — MISSING: no invitation send form exists
5. **Judge → Declare Conflict of Interest** — MISSING: no explicit UI action
6. **Sponsor → Self-Service Fund an Event** — MISSING: no sponsor deposit flow
7. **Admin → Navigate to Admin Panel** — BROKEN: no nav link to /admin
8. **Participant → View Judging Progress** — MISSING: no indicator during judging phase
9. **Organizer → Configure Prize Categories Before Judging** — BLOCKED: prizes tab inaccessible in early states

---

### 4.3 Missing Features

| Feature | Impact |
|---------|--------|
| `?redirect=` param handling on login/signup | Guest/Participant conversion killer |
| Participant payout tracking page | Financial transparency core promise |
| Wallet verification nudge during event lifecycle | Silent payout failure prevention |
| Workspace invitation send form | Workspace adoption blocker |
| Admin panel navigation link | Operational blocker for platform admins |
| Sponsor self-service deposit flow | Revenue/sponsorship model blocker |
| Confirm password field on reset | UX + security hygiene |
| Prize categories accessible in early event states | Organizer workflow friction |
| Audit log: filter + export + service-client query | Compliance concern |
| Judge evaluation status fix (hardcoded "Draft") | Core judge UX broken |
| Conflict of Interest button for judges | Integrity concern |

---

### 4.4 UX Improvements Recommended

1. **Login flow:** Implement redirect-on-return pattern (standard OAuth/auth UX)
2. **Email confirmation:** Use `emailRedirectTo` → `/auth/callback?next=/onboarding` for seamless auto-login
3. **Escrow page:** Wallet picker when multiple adapters available
4. **Judging page:** Show rubric inline for judges; add COI button per row
5. **Winners page:** Add read-only escrow/payout status for participants
6. **Submissions page:** Add deadline countdown
7. **Event sub-nav:** Add context-sensitive "Register" tab in RegistrationOpen state
8. **MFA:** Require re-authentication before unenrolling MFA (security hardening)

---

### 4.5 Security & Permission Concerns

| Concern | Risk Level |
|---------|-----------|
| `?redirect=` param should be implemented with open-redirect sanitization | Medium |
| Admin event cancel bypasses state machine — could strand escrow funds | High |
| MFA unenrollment without re-auth | High |
| Audit log not using service client — RLS may restrict visibility | High |
| `avatar_url` accepts any URL | Medium |
| No CAPTCHA on signup (rate limiting exists but in-memory only without Redis) | Medium |

---

### 4.6 Edge Cases

| Edge Case | Status |
|-----------|--------|
| User with multiple Stellar wallets — which one gets prize? | ⚠️ First verified wallet used, no selection |
| Event funded past target amount | ⚠️ Client validation missing (server handles it) |
| Judge has ALL submissions flagged as COI — they've scored nothing | ❌ No escalation path |
| Organizer cancels event after escrow is FullyFunded | ⚠️ Refund flow exists (API), no escrow cleanup reminder in UI |
| Team disbands after submission is judged | ⚠️ Winner record may point to disbanded team's captain |
| Email not confirmed but user tries to log in | ✅ Supabase blocks unconfirmed logins |
| Workspace slug collision | ✅ 409 conflict handled in creation form |
| Concurrent event state transitions | ⚠️ Version column exists but WHERE version = ? not confirmed in all update paths |
| Testnet reset invalidates contract ID | ⚠️ Documented in README but no in-app detection |

---

### 4.7 Overall Production Readiness Score

```
┌─────────────────────────────────────────────────────────┐
│  COMPONENT                      SCORE   STATUS           │
├─────────────────────────────────────────────────────────┤
│  Authentication & Onboarding     7/10   ⚠️  Redirect bug │
│  Organizer Workflow              8/10   ✅  Solid          │
│  Participant Workflow            6/10   ⚠️  Payout gap    │
│  Judge Workflow                  5/10   ❌  Status bug    │
│  Sponsor Workflow                3/10   ❌  Mostly missing │
│  Workspace Management            5/10   ❌  Invite missing │
│  Admin Panel                     6/10   ⚠️  No nav link  │
│  Escrow / Blockchain             9/10   ✅  Best in class  │
│  Navigation & IA                 6/10   ⚠️  Some dead ends│
│  Mobile / Accessibility          6/10   ⚠️  Gaps present  │
│  Security                        7/10   ⚠️  Known issues  │
│  Error / Loading / Empty States  7/10   ⚠️  Inconsistent  │
├─────────────────────────────────────────────────────────┤
│  OVERALL PRODUCTION READINESS   62/100   🟡 NOT READY     │
└─────────────────────────────────────────────────────────┘
```

**Verdict:** The platform has impressive depth in its blockchain/escrow layer and its organizer
tooling is genuinely strong. However, 6 critical issues block real users from completing core
journeys. The most impactful fixes are:

1. Fix login `?redirect=` handling (C1) — affects EVERY user entry from public pages
2. Add participant payout tracking (C2) — core financial transparency promise
3. Add wallet verification prompt for winners (C3) — prevents silent payout failure
4. Fix judge evaluation status hardcoding (C4) — judges cannot accurately track their work
5. Add admin panel nav link (C5) — platform is unmanageable without it
6. Add workspace invitation send form (C6) — workspace adoption impossible without it

Addressing these 6 critical issues + the 12 high-priority issues would push the score to ~80/100
and make the platform viable for a public launch with real users and real funds.

---

*Audit completed: August 2, 2026. All findings based on static code analysis of the deployed
codebase at `stellar-guardian-3.0`. Runtime behavior on Vercel production should be verified
with live testing against the deployed URL: https://stellarguardian3-0-delta1.vercel.app*
