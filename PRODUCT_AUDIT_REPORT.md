# Stellar Guardian 3.0 — Comprehensive Product Discovery, System Audit & Gap Analysis

**Date:** July 19, 2026  
**Auditor:** Senior Product/Engineering Team Assessment  
**Version:** 1.0  

---

## Executive Summary

Stellar Guardian 3.0 is a **hackathon/event management platform** backed by Stellar blockchain escrow. It enables organizers to create events (hackathons, bounties, challenges), fund prize pools via Stellar escrow accounts, manage teams, evaluate submissions, and disburse prizes on-chain to verified wallets.

**Current State:** The platform has undergone a substantial architectural conversion from React+Vite SPA / Express monolith to a Next.js 16 App Router full-stack application with Supabase PostgreSQL. Core infrastructure is solid — state machines, escrow service, wallet verification, permission matrix, and middleware are all implemented. However, **significant product and UX gaps remain** that would prevent production readiness.

### Critical Findings Summary

| Priority | Count | Categories |
|----------|-------|------------|
| **Critical** | 12 | Security, financial workflows, data integrity |
| **High** | 18 | Missing features, broken workflows, UX gaps |
| **Medium** | 24 | Polish, optimization, missing states |
| **Low** | 15 | Nice-to-haves, future enhancements |

---

## 1. Product Discovery Findings

### 1.1 Business Goals Assessment

The platform serves a clear niche: **trustless event prize distribution** using blockchain escrow. The business model relies on organizers trusting the platform to custody and distribute funds fairly. This requires exceptional transparency, security, and workflow completeness.

### 1.2 Missing Product Capabilities

| # | Missing Capability | Why It Matters | Priority |
|---|---|---|---|
| 1 | **No landing page / marketing page** | Root `/` just redirects. No value proposition, no conversion funnel. New visitors see nothing. | Critical |
| 2 | **No password reset flow** | Users who forget passwords cannot recover accounts. Auth dead-end. | Critical |
| 3 | **No email verification** | Accounts can be created with unverified emails. Security + spam risk. | Critical |
| 4 | **No invitation acceptance flow** | `invitation.ts` service exists but no page for accepting invite links. | High |
| 5 | **No public event detail page** | `/events/[id]` requires auth. Discover page links to events users can't view without login. | High |
| 6 | **No sponsor management UI** | API endpoint exists (`/api/events/[id]/sponsors`) but no frontend for managing sponsors. | High |
| 7 | **No milestone management UI** | Same pattern — API exists, no UI. | High |
| 8 | **No workspace invitation UI** | No page for workspace owners to invite members. | High |
| 9 | **No submission creation/editing UI** | Submissions page exists but no form to create/edit submissions. | High |
| 10 | **No evaluation/scoring UI** | Judging page has no actual scoring interface for judges. | High |
| 11 | **No winner selection UI** | Winners page shows data but no interface to select/assign winners. | High |
| 12 | **No dispute filing UI** | Disputes page exists but no form for participants to file disputes. | High |
| 13 | **No profile editing** | Settings page shows profile info (read-only name/email) but no edit form. | Medium |
| 14 | **No user search/directory** | Members shown only by UUID, not by name. No user lookup. | Medium |
| 15 | **No event duplication/template** | Organizers must recreate events from scratch every time. | Medium |
| 16 | **No bulk participant approval** | Event members must be approved individually — no batch actions. | Medium |
| 17 | **No export functionality** | No way to export participant lists, submissions, or results. | Medium |
| 18 | **No multi-language support (i18n)** | English-only. | Low |
| 19 | **No keyboard shortcuts** | No productivity shortcuts for power users. | Low |
| 20 | **No help/documentation system** | No in-app help, tooltips, or documentation links. | Low |


### 1.3 Missing User Journeys

| Journey | Current State | Gap |
|---------|--------------|-----|
| **First-time visitor** | Redirect to login. No value proposition. | Need landing page with social proof, feature overview, CTA |
| **Sponsor joining** | No self-service sponsor flow | Need sponsor application/invitation + contribution page |
| **Judge onboarding** | Added via event_members table | No judge-specific onboarding, rubric explanation, or conflict-of-interest disclosure flow |
| **Participant team formation** | Teams page exists (view only) | No self-service team creation, join requests, or team matching |
| **Submission revision** | `submission_versions` table exists | No UI for viewing version history or creating revisions |
| **Winner notification** | System notification created | No dedicated "You won!" experience with claim instructions |
| **Prize claim by winners without wallets** | "held" status recorded | No flow guiding unverified winners to connect wallet and claim |

---

## 2. UX/UI Audit Report

### 2.1 Information Architecture Issues

| Issue | Severity | Details |
|-------|----------|---------|
| **Navigation inconsistency** | High | Desktop nav links to `/discover`, `/dashboard`, `/events/new`. Mobile nav mirrors this. But there's no link to `/workspaces`, `/admin`, or `/profile`. These are reachable only through dashboard or direct URL. |
| **Dead nav link: "Docs"** | Medium | Footer links "Docs" to `/discover` which is not documentation. |
| **No breadcrumbs on most pages** | Medium | `breadcrumbs.tsx` component exists but is only used in event-detail. Other deep pages (workspace settings, admin audit) have no navigation context. |
| **Profile dropdown leads to /settings** | Low | No separate profile page linked from dropdown (there's one at `/profile/[userId]` but it's unreachable from nav). |

### 2.2 Design System Consistency Issues

| Issue | Severity | Details |
|-------|----------|---------|
| **Mixed styling approaches** | High | Login/signup uses raw Tailwind (`bg-neutral-900`, `border-neutral-300`). App pages use CSS custom properties (`var(--text)`, `var(--border)`). These don't respond to theme changes consistently. |
| **Create event page ignores theme** | High | Hardcoded `bg-neutral-900`, `text-neutral-500`, `border-neutral-300` — will look wrong in dark mode. |
| **Discover page ignores theme** | High | Same issue — uses hardcoded `border-neutral-200`, `text-neutral-500`, `bg-neutral-100`. |
| **No component library documentation** | Medium | 5 shared UI components exist (`breadcrumbs`, `data-table`, `empty-state`, `event-state-badge`, `loading-state`) but many pages reimplement loading/empty states inline. |
| **Inconsistent button patterns** | Medium | Some pages use `btn-primary` class, others use inline `bg-neutral-900` or `bg-[var(--btn-primary-bg)]`. |

### 2.3 Accessibility (WCAG) Issues

| Issue | Severity | WCAG Criterion |
|-------|----------|----------------|
| **No skip-to-content link** | High | 2.4.1 Bypass Blocks |
| **Mobile menu toggle uses emoji text** | High | `"✕"` and `"☰"` have no accessible label for the semantic meaning. | 1.1.1 Non-text Content |
| **Forms missing required field indicators** | Medium | 3.3.2 Labels or Instructions |
| **No focus management on tab switch** | Medium | Event detail tabs don't move focus to content panel. | 2.4.3 Focus Order |
| **Alert role usage** | Low | Error messages use `role="alert"` correctly in some forms but not all. |
| **Color contrast unverified** | Medium | Custom property system means contrast depends on runtime values — needs manual verification. | 1.4.3 Minimum Contrast |
| **No keyboard trap handling in dropdowns** | Medium | Profile dropdown doesn't trap focus or close on Escape. | 2.1.2 No Keyboard Trap |
| **No aria-live regions for realtime notifications** | Medium | Notification bell and page don't announce new notifications to screen readers. | 4.1.3 Status Messages |


### 2.4 Missing UI States

| Page/Component | Missing State | Priority |
|----------------|--------------|----------|
| **Create Event** | Success state (just redirects to dashboard) | Medium |
| **Create Event** | Server-side validation error display (only catches DB errors) | High |
| **Event Detail - Settings tab** | No confirmation dialog for state transitions | Critical |
| **Event Detail - Settings tab** | No undo/rollback after accidental state change | High |
| **Escrow page** | "Fund Escrow" just shows an `alert()` — no actual wallet signing flow | Critical |
| **Discover page** | No pagination (hardcoded `limit(20)`, no "Load More" or page navigation) | High |
| **Dashboard** | Capped at 20 event memberships with no "View all" | Medium |
| **Notifications** | No filter by category or read/unread | Medium |
| **Settings** | No loading state for wallet removal action | Low |
| **All forms** | No autosave / draft recovery | Medium |

### 2.5 Mobile Responsiveness Issues

| Issue | Severity |
|-------|----------|
| Event detail tabs can overflow on mobile (horizontal scroll, no wrap) | Medium |
| Create event form fields equally split on mobile (`grid-cols-2`) without responsive collapse | Medium |
| Admin KPI grid collapses to single column but data table (if present) has no responsive treatment | Low |
| Escrow page grid may overflow with long Stellar public keys on small screens | Medium |

---

## 3. Workflow & Lifecycle Audit

### 3.1 Event Lifecycle (16 States)

**Current State Machine:**
Draft → Published → RegistrationOpen → RegistrationClosed → TeamFormation → SubmissionOpen → SubmissionClosed → Judging → ReviewObjectionWindow → WinnersFinalized → OrganizerFundsEscrow → EscrowLocked → PrizeDistribution → Completed → Archived

**Critical Gaps:**

| Gap | Severity | Impact |
|-----|----------|--------|
| **State transitions in event-detail-client bypass the state machine** | Critical | `handleStateChange` directly updates the database without calling `canTransition()`. This means preconditions are not checked, invalid transitions are possible from the frontend. |
| **No approval workflow for member applications** | High | Participants apply (`status: "pending"`) but there's no UI for organizers to approve/reject them. The event can progress to TeamFormation with pending members. |
| **No automated transition from Judging → ReviewObjectionWindow** | Medium | Relies on organizer manually triggering. No "all evaluations submitted" detection. |
| **Review window expiry not enforced** | High | The `review_window_hours` is stored but no scheduled job transitions the event out of ReviewObjectionWindow after the window expires. |
| **Missing transitions in Settings tab** | Medium | UI only shows transitions up to Judging. States after SubmissionClosed (ReviewObjectionWindow → WinnersFinalized → etc.) have no UI buttons. |
| **Cancellation from any state** | Medium | "Cancel Event" button is always shown but doesn't check if cancellation is valid from the current state (e.g., post-disbursement). |

### 3.2 Escrow Workflow Gaps

| Gap | Severity | Impact |
|-----|----------|--------|
| **Funding flow is non-functional (alert-only)** | Critical | "Fund Escrow" button shows `alert()`. No actual wallet transaction signing, no submission to `/api/events/[id]/fund`. |
| **No link between event state and escrow state** | High | Event transitions to "OrganizerFundsEscrow" but nothing triggers escrow account creation automatically. |
| **No disbursement trigger in UI** | High | `/api/events/[id]/disburse` endpoint exists but no button/page initiates it. |
| **No refund trigger in UI** | High | Same issue — `/api/events/[id]/refund` exists with no frontend access. |
| **Reconciliation not triggered periodically** | Medium | `reconcileEscrow` function exists but no cron job or UI trigger calls it. |
| **Secret key stored as base64, not KMS-encrypted** | Critical | Comment says "In production, this would be KMS-envelope-encrypted" but current code does `Buffer.from(secretKey).toString("base64")`. This is NOT encryption. |


### 3.3 Team Formation Workflow Gaps

| Gap | Severity | Impact |
|-----|----------|--------|
| No team creation UI | High | Teams page only displays existing teams. No form to create one. |
| No join request flow | High | Participants can't request to join teams. |
| No team captain invite flow | High | Captains can't invite specific users. |
| No team size validation in UI | Medium | DB enforces team_size_min/max but no client-side feedback. |
| No "looking for team" matching | Medium | No way for solo participants to find teams with openings. |

### 3.4 Judging Workflow Gaps

| Gap | Severity | Impact |
|-----|----------|--------|
| No evaluation form/rubric UI | Critical | `/api/events/[id]/evaluations` endpoint exists. No frontend for judges to score submissions. |
| No conflict-of-interest check in UI | High | Backend has `evaluation.conflict_of_interest` audit action but no UI warning/blocking when a judge scores their own team's submission. |
| No score aggregation/ranking display | High | Winners page exists but no ranked leaderboard showing scores. |
| No judge assignment interface | Medium | No way to assign specific judges to specific submissions (round-robin, random, etc.). |

### 3.5 Dispute Workflow Gaps

| Gap | Severity | Impact |
|-----|----------|--------|
| No dispute filing form | High | Disputes page shows existing disputes but has no "File Dispute" button or form. |
| No evidence upload for disputes | High | `dispute_evidence` table exists in schema but no UI or API for uploading evidence. |
| No dispute resolution interface for organizers/admins | High | `transitionDispute` service exists but no frontend for managing disputes. |
| No dispute timeline view | Medium | No chronological view of dispute state changes. |

---

## 4. Database & Backend Audit

### 4.1 Schema Assessment

**Strengths:**
- Well-normalized schema with proper foreign keys and CHECK constraints
- Version columns for optimistic concurrency on mutable resources
- GIN full-text index for event search
- Partial unique indexes for business rules (judge/participant exclusion, one team per participant)
- Append-only enforcement on audit_records
- RLS enabled with comprehensive policies

**Missing Tables/Entities:**

| Entity | Purpose | Priority |
|--------|---------|----------|
| `webhook_endpoints` | Referenced in webhook.ts service but no migration creates it | High |
| `user_preferences` | Email digest frequency, notification preferences (TODO in notification.ts) | Medium |
| `event_rubrics` / `evaluation_criteria` | Structured judging criteria per event | Medium |
| `team_join_requests` | Self-service team formation flow | Medium |
| `saved_drafts` | Form auto-save for event creation | Low |
| `user_sessions` / `session_audit` | Track active sessions for security | Low |
| `announcement` / `event_updates` | Organizer communications to participants | Medium |

### 4.2 Missing Indexes

| Table | Missing Index | Reason |
|-------|---------------|--------|
| `transactions` | `idx_transactions_tx_hash` | Unique constraint exists but explicit index speeds lookup |
| `notifications` | `idx_notifications_user_read` | Composite index on `(user_id, read)` for unread count queries |
| `audit_records` | `idx_audit_workspace_id` | Workspace-scoped audit queries |
| `winners` | `idx_winners_event_status` | `(event_id, disbursement_status)` for disbursement queries |

### 4.3 Missing Constraints

| Issue | Severity |
|-------|----------|
| No ON DELETE policy for `workspaces → events` cascade (currently RESTRICT but no soft-delete) | Medium |
| `events.fts` column added without NOT NULL DEFAULT (nullable tsvector) | Low |
| No CHECK on `notifications.priority` values | Low |
| No rate-limit tracking table (in-memory only, lost on redeploy) | High |


### 4.4 API Gap Analysis

**Existing Endpoints (35+):** Well-structured REST API with consistent error handling, Zod validation, idempotency on financial endpoints, and cursor-based pagination.

**Missing Endpoints:**

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `POST /api/auth/reset-password` | Password reset request | Critical |
| `POST /api/auth/reset-password/confirm` | Password reset confirmation | Critical |
| `POST /api/auth/verify-email` | Email verification | Critical |
| `PATCH /api/events/[id]` | Event update (edit page has no API call target for partial updates) | High |
| `POST /api/events/[id]/teams` | Team creation by participants | High |
| `POST /api/events/[id]/teams/[teamId]/join` | Team join request | High |
| `POST /api/events/[id]/disputes/[disputeId]/evidence` | Evidence upload for disputes | High |
| `PATCH /api/events/[id]/disputes/[disputeId]` | Dispute state transition | High |
| `POST /api/events/[id]/members/[userId]/approve` | Approve member application | High |
| `POST /api/events/[id]/members/[userId]/reject` | Reject member application | High |
| `GET /api/users/search` | User search/directory | Medium |
| `GET /api/events/[id]/leaderboard` | Aggregated scores/ranking | Medium |
| `POST /api/workspaces/[slug]/webhooks` | Webhook endpoint management | Medium |
| `POST /api/events/[id]/announcements` | Organizer → participant communications | Medium |
| `GET /api/events/[id]/export` | Export participants/results | Low |

### 4.5 API Contract Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Event creation bypasses API route | High | `events/new/page.tsx` inserts directly via browser Supabase client instead of calling `/api/events`. This bypasses any API-level business logic, audit trail, and rate limiting. |
| State transitions bypass API | Critical | `event-detail-client.tsx` updates state directly via browser client. Bypasses `canTransition()` checks, audit records, notifications, and permission matrix enforcement. |
| Member application bypasses API | High | `handleApply` in event-detail inserts directly to `event_members` via browser client. |
| Wallet removal via client-side RLS only | Medium | Settings page deletes wallets directly. No server-side validation that wallet isn't actively used in pending disbursements. |

---

## 5. Security Review

### 5.1 Critical Security Issues

| Issue | Severity | Impact | Recommendation |
|-------|----------|--------|----------------|
| **Escrow secret key stored as base64, not encrypted** | Critical | If database is compromised, all escrow keys are immediately usable. Current code is `Buffer.from(secretKey).toString("base64")` which is encoding, not encryption. | Implement actual KMS envelope encryption (AWS KMS, Google Cloud KMS, or Vault). |
| **State transitions from frontend bypass authorization** | Critical | Any authenticated user can potentially change event state via the browser Supabase client if RLS policies are misconfigured. Defense-in-depth requires API-layer enforcement. | All mutations must go through Route Handlers that check `canTransition()` + permission matrix. |
| **In-memory rate limiter resets on deployment** | High | `rateLimitStore` is a `Map` in middleware — lost on every serverless cold start or new deployment. Brute force protection is unreliable. | Use Redis, Upstash, or Supabase-based rate limiting. |
| **No CSRF protection on forms** | Medium | Forms POST via `fetch()` (OK for API routes with auth headers) but the form-action based discover search could be vulnerable. | Use SameSite cookies (already set by Supabase SSR) + verify origin header. |
| **CSP nonce is hardcoded string 'nonce-csp'** | High | Production CSP uses `'nonce-csp'` which is a static string, not a random nonce. This provides zero XSS protection. | Generate per-request nonce and inject into both CSP header and script tags. |
| **No audit trail for direct client-side mutations** | High | Events, members, and teams created/modified via browser client leave no audit record. | Route all mutations through API endpoints with audit service integration. |
| **No account lockout after failed login attempts** | Medium | Rate limiter helps but doesn't lock specific accounts. | Implement progressive delay or temporary lockout per email. |
| **No session revocation** | Medium | Users can't revoke other sessions or see active sessions. | Add session management UI and server-side session invalidation. |


### 5.2 Authentication & Authorization Gaps

| Issue | Severity | Details |
|-------|----------|---------|
| No email verification on signup | Critical | Accounts work immediately without verifying email ownership |
| No 2FA/MFA support | Medium | Financial platform handling cryptocurrency should offer MFA |
| No admin role gate on admin page | High | Admin page fetches data but doesn't verify the user is actually a PlatformAdmin before rendering |
| API public prefix too broad | Medium | `PUBLIC_PREFIXES` includes `/api/events/` — this makes ALL event sub-routes public (including POST to fund, disburse, etc.). The route-level auth check catches this, but the middleware inconsistency is a risk. |
| Legal acceptance not enforced at middleware level | Medium | `requireLegalAcceptance` is called in individual endpoints — missing it in one endpoint is an easy oversight |

---

## 6. Architecture Review

### 6.1 Strengths

- **Clean layered architecture**: Routes → Services → Database with clear separation
- **Shared state machines**: Pure TypeScript module usable server + client
- **Typed error hierarchy**: Maps to HTTP status codes with consistent envelope
- **Idempotency service**: Proper implementation for financial operations
- **Property-based tests**: fast-check integrated for correctness verification
- **Optimistic concurrency**: Version columns prevent lost-update race conditions
- **Defense-in-depth**: Permission matrix at API + RLS at database level

### 6.2 Architecture Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| **Client-side mutations bypassing API layer** | Critical | Multiple pages (event creation, state changes, member applications) directly use the Supabase browser client for writes. This creates two mutation paths: one audited (API), one unaudited (direct). |
| **No service-layer error boundaries** | High | If `writeAuditRecord` or `createNotification` fails, the primary operation still succeeds but side-effects are silently lost. No dead-letter queue or retry for failed notifications. |
| **Webhook table doesn't exist** | High | `webhook.ts` service references `webhook_endpoints` table that has no migration. Service would throw at runtime. |
| **Singleton Stellar client** | Medium | `getStellarClient()` caches one instance. In serverless, this is fine (short-lived), but the `require()` call for Keypair is synchronous and non-standard for ESM. |
| **No background job infrastructure** | Medium | Scheduled jobs rely on external cron hitting `/api/cron`. No dead-letter, no observability, no retry tracking. |
| **No feature flags** | Medium | Design mentions "per-workspace feature flags" but none are implemented. |
| **No API versioning enforcement** | Low | `/api/v1/events` exists but internal routes aren't versioned. No deprecation strategy. |

### 6.3 Scalability Concerns

| Concern | Impact | Recommendation |
|---------|--------|----------------|
| In-memory rate limiter | Won't work across multiple serverless instances | Use external store (Redis/Upstash) |
| No database connection pooling configuration | May hit Supabase connection limits under load | Configure pgBouncer/Supavisor |
| Discover page fetches all events every load | N+1 potential with no caching | Add ISR or SWR caching layer |
| Audit export limited to 10k records | Large workspaces will exceed this | Stream exports or background job |
| Realtime subscription per-user | May hit Supabase realtime limits | Consider aggregation channels |

---

## 7. Feature Gap Analysis (vs. Modern SaaS Standards)

### 7.1 Expected Features — Absent

| Feature | Industry Standard | Current State | Priority |
|---------|------------------|---------------|----------|
| **Activity timeline** | All SaaS platforms show chronological activity feeds | API exists (`/activity`), no UI component for it on event pages | High |
| **Comments/discussions** | GitHub, Linear, Notion all support threaded comments | No comment system on events, submissions, or disputes | High |
| **File attachments on submissions** | Standard for hackathon platforms | `submission_files` table exists, no upload UI in submission flow | High |
| **Saved drafts / autosave** | Google Docs, Notion, Linear | No draft persistence. Form data lost on navigation. | Medium |
| **Undo actions** | Gmail, Slack, Notion | No undo for state transitions, member removal, etc. | Medium |
| **Bulk actions** | All admin/management tools | No multi-select for approving members, assigning winners, etc. | Medium |
| **CSV/PDF export** | Standard reporting feature | Audit export exists (JSON/CSV) but no UI. No participant/result export. | Medium |
| **Search within workspace** | Slack, Linear, Notion | Only discover page has search. No search within "My Events" or workspace. | Medium |
| **Collaborative editing** | Notion, Google Docs | No real-time collaboration on event configuration | Low |
| **Webhooks management UI** | GitHub, Stripe, all API platforms | Service exists but no table + no UI | Medium |
| **Event templates** | Eventbrite, Devpost | No way to save and reuse event configurations | Low |
| **Participant analytics** | Devpost, HackerEarth | No registration funnel, engagement metrics, or completion rates | Medium |
| **Email templates (customizable)** | All SaaS with email | Hardcoded HTML string in notification service | Low |


### 7.2 Competitive Gap (vs. Devpost, HackerEarth, Gitcoin)

| Competitor Feature | Stellar Guardian Status |
|-------------------|----------------------|
| Public event listing with rich cards | Partial (basic grid, no images/organizer info) |
| Registration countdown timer | Missing |
| Team matching / "Looking for Teammates" | Missing |
| Submission gallery (public showcase) | Missing |
| Judge dashboard with pending evaluations queue | Missing |
| Prize breakdown visualization | Missing |
| Participant certificates | Missing |
| Event analytics dashboard for organizers | Missing |
| Social sharing (Open Graph meta) | Missing |
| Email marketing (event announcements) | Missing |
| Sponsor logo/tier display | Missing |
| Mentor matching | Missing |

---

## 8. Prioritized Recommendations

### Critical (Must Fix Before Any Production Use)

| # | Issue | Solution | Complexity | Dependencies |
|---|-------|----------|------------|--------------|
| C1 | Escrow secret key not encrypted | Implement KMS envelope encryption via AWS KMS or similar | Medium | Infrastructure setup |
| C2 | No password reset | Implement Supabase Auth password reset flow + UI pages | Low | None |
| C3 | No email verification | Enable Supabase email confirmation + verification page | Low | Email provider |
| C4 | State transitions bypass state machine from frontend | Remove direct browser-client mutations; route ALL writes through API endpoints | High | Refactor event-detail-client, create-event, member-apply |
| C5 | CSP nonce is static string | Generate per-request cryptographic nonce in middleware | Low | None |
| C6 | Funding flow non-functional (alert only) | Build complete wallet-signing → API call → verification flow | High | Wallet adapter integration |
| C7 | In-memory rate limiter (lost on deploy) | Replace with Upstash Redis or Supabase-based rate limiting | Medium | External service |
| C8 | No landing page | Build marketing/conversion page at `/` for unauthenticated users | Medium | Design decision |
| C9 | No evaluation/judging UI | Build scoring interface for judges with rubric support | High | Evaluation API is ready |
| C10 | Admin page has no role check | Add PlatformAdmin role verification before rendering admin content | Low | Permission service |
| C11 | Scoring criteria undefined | Add evaluation rubrics table + per-event criteria management | Medium | DB migration |
| C12 | No dispute filing or resolution UI | Build dispute forms + organizer resolution interface | Medium | Dispute API is ready |

### High Priority (Required for Beta)

| # | Issue | Solution | Complexity |
|---|-------|----------|------------|
| H1 | No public event detail (unauthenticated view) | Create `/(public)/events/[id]` with limited info + "Login to participate" CTA | Low |
| H2 | Theme inconsistency (hardcoded colors) | Refactor login, signup, create-event, discover to use CSS custom properties | Medium |
| H3 | No team creation/join UI | Build team formation interface with create, invite, join request flows | High |
| H4 | No submission creation UI | Build submission form with file upload and version management | High |
| H5 | No winner selection UI | Build interface for organizers to assign winners + prize amounts | Medium |
| H6 | No member approval workflow | Build approve/reject interface in event members tab | Medium |
| H7 | No sponsor management UI | Build sponsor tier/contribution management page | Medium |
| H8 | No invitation acceptance page | Build `/invitations/[token]` acceptance flow | Low |
| H9 | Missing transitions in lifecycle UI | Add buttons for all valid transitions (ReviewObjectionWindow → Completed) | Medium |
| H10 | Review window expiry not automated | Add scheduled job to auto-transition after review_window_hours | Medium |
| H11 | Webhook table missing from migrations | Create migration for `webhook_endpoints` table | Low |
| H12 | Event creation should use API route | Refactor to POST to `/api/events` instead of direct insert | Medium |
| H13 | No activity timeline UI on event pages | Build chronological activity feed component using existing API | Medium |
| H14 | No pagination on discover page | Add cursor-based "Load More" using existing discovery service | Low |
| H15 | Notification preferences not implemented | Build preferences UI + respect them in notification service | Medium |
| H16 | No disbursement/refund trigger in UI | Add action buttons on escrow page when state allows | Medium |
| H17 | Direct DB writes from browser leave no audit trail | Ensure all mutations go through audited API endpoints | High |
| H18 | No confirmation dialogs for destructive actions | Add confirmation modals for state transitions, cancellation, removals | Low |


### Medium Priority (Post-Beta Polish)

| # | Issue | Solution | Complexity |
|---|-------|----------|------------|
| M1 | No profile editing | Add display name, avatar, bio edit form in settings | Low |
| M2 | No search within "My Events" | Add client-side filter or server-side search on dashboard | Low |
| M3 | Members shown as UUIDs | Join user display_name in member queries | Low |
| M4 | No breadcrumbs on most pages | Add breadcrumb component to all nested pages | Low |
| M5 | No event duplication | Add "Duplicate" button that prefills create-event form | Low |
| M6 | No bulk member approval | Add multi-select checkbox + batch approve/reject | Medium |
| M7 | No export functionality | Add CSV export for participants, results, transactions | Medium |
| M8 | No comments on submissions | Build comment system (table + API + UI) | High |
| M9 | Missing Open Graph / social meta | Add dynamic OG images and meta tags for event pages | Medium |
| M10 | No registration countdown | Add countdown timer component on event detail | Low |
| M11 | No skip-to-content link | Add hidden skip link at top of page | Low |
| M12 | Dropdown focus management | Implement focus trap and Escape key handler | Low |
| M13 | Dead "Docs" footer link | Replace with actual documentation or remove | Low |
| M14 | Form autosave | Implement localStorage-based draft persistence | Medium |
| M15 | Email templates hardcoded | Build email template system with React Email or similar | Medium |
| M16 | No sponsor logo display | Add sponsor tier/branding to event pages | Medium |
| M17 | No 2FA support | Enable Supabase MFA for sensitive accounts | Medium |
| M18 | No event analytics dashboard | Build organizer analytics (registration funnel, engagement) | High |
| M19 | Notification category filter | Add filter tabs on notifications page | Low |
| M20 | No "looking for team" feature | Add matchmaking/open team discovery | High |
| M21 | Prize breakdown visualization | Add visual chart of prize allocation | Medium |
| M22 | No mobile-specific optimizations | Review all pages for touch targets, swipe gestures | Medium |
| M23 | No dark mode on auth pages | Refactor login/signup to use CSS variables | Low |
| M24 | No keyboard shortcuts | Add cmd+k search, navigation shortcuts | Medium |

### Low Priority (Future Enhancements)

| # | Issue | Solution |
|---|-------|----------|
| L1 | No i18n / multi-language | Implement next-intl or similar |
| L2 | No participant certificates | Generate PDF certificates for completed events |
| L3 | No mentor matching | Add mentor role flow with booking |
| L4 | No collaborative editing | Add real-time co-editing for event config |
| L5 | No event templates | Save/load event configurations |
| L6 | No API versioning strategy | Define deprecation timeline and versioning policy |
| L7 | No feature flags | Implement per-workspace feature flag system |
| L8 | No email marketing | Add announcement/broadcast to participants |
| L9 | No session management UI | Show active sessions + revocation |
| L10 | No submission gallery | Public showcase of completed submissions |
| L11 | No judge assignment algorithm | Automated fair distribution of submissions to judges |
| L12 | No webhook management UI | CRUD interface for workspace webhook endpoints |
| L13 | No audit log export UI | Add export button on admin audit page |
| L14 | No user deletion (GDPR) | Account deletion with data anonymization |
| L15 | No API rate limit dashboard | Show remaining quota to users |

---

## 9. Implementation Roadmap

### Phase 1: Security & Critical Fixes (1-2 weeks)
1. KMS envelope encryption for escrow keys (C1)
2. Password reset flow (C2)
3. Email verification (C3)
4. Fix CSP nonce (C5)
5. Admin role gate (C10)
6. Persistent rate limiting (C7)
7. Route all mutations through API (C4, H12, H17)

### Phase 2: Core Workflow Completion (2-3 weeks)
1. Functional funding flow with wallet signing (C6)
2. Judging/evaluation UI (C9, C11)
3. Team creation/join flow (H3)
4. Submission creation with file upload (H4)
5. Winner selection UI (H5)
6. Dispute filing and resolution UI (C12)
7. Member approval workflow (H6)
8. Complete lifecycle transition UI (H9, H10)

### Phase 3: Product Completeness (2-3 weeks)
1. Landing page / marketing (C8)
2. Public event detail page (H1)
3. Theme consistency fix (H2)
4. Activity timeline UI (H13)
5. Invitation acceptance flow (H8)
6. Pagination on discover (H14)
7. Disbursement/refund UI triggers (H16)
8. Confirmation dialogs (H18)

### Phase 4: Polish & Enhancement (2-4 weeks)
1. Profile editing (M1)
2. User display names instead of UUIDs (M3)
3. Search, filtering, export (M2, M6, M7)
4. Comments system (M8)
5. Sponsor display (M16)
6. Analytics dashboard (M18)
7. Notification preferences (H15)
8. Accessibility fixes (M11, M12)

---

## 10. Technical Debt Summary

| Category | Items | Severity |
|----------|-------|----------|
| Direct browser-client mutations (bypass API) | 4 instances | Critical |
| Static CSP nonce (no XSS protection) | 1 | Critical |
| Unencrypted secrets in DB | 1 | Critical |
| Hardcoded styling ignoring theme system | 3 pages | High |
| In-memory state (rate limiter) | 1 | High |
| Missing database table for existing service | 1 (webhooks) | High |
| TODO comments in production code | ~5 | Medium |
| Deprecated React `FormEvent` usage | 2 files | Low |
| `require()` in ESM context (stellar client) | 1 | Low |

---

## 11. Conclusion

Stellar Guardian 3.0 has strong architectural foundations — the state machine design, service layer, permission matrix, and error model are well-engineered. The conversion from the monolithic Express/Vite app to Next.js App Router is substantially complete at the infrastructure level.

However, **the product is approximately 55-60% complete** from a user-facing perspective. The backend services exist for most workflows, but many critical UI flows (judging, team formation, disputes, escrow funding) have no frontend implementation. The most dangerous issue is the pattern of client-side database mutations that bypass the carefully-designed API layer with its authorization checks, state machine enforcement, and audit trails.

**The #1 priority before any production deployment** is ensuring all mutations flow through the API layer and that escrow secret keys receive proper encryption. Without these, the platform cannot be trusted with real funds.

---

*End of Report*
