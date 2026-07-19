# Stellar Guardian 3.0 — Comprehensive Product Discovery, System Audit & Gap Analysis

**Date:** July 19, 2026  
**Auditor:** Senior Product/Engineering Team Assessment (AI-Assisted)  
**Version:** 2.0 (Verified against actual codebase)  
**Methodology:** Full codebase inspection via automated agent analysis — every claim cross-referenced with source files.

---

## Executive Summary

Stellar Guardian 3.0 is a **hackathon/event management platform** backed by Stellar blockchain escrow. It enables organizers to create events (hackathons, bounties, challenges), fund prize pools via Stellar escrow accounts, manage teams, evaluate submissions, and disburse prizes on-chain to verified wallets.

**Current State:** The platform has undergone a substantial architectural conversion from React+Vite SPA / Express monolith to a **Next.js 16.2.10 App Router** full-stack application with **Supabase PostgreSQL**. Core infrastructure is solid — state machines, escrow service, wallet verification (Freighter), permission matrix, and middleware are all implemented. The legacy codebase (root `package.json` with Express/SQLite/Vite) still exists alongside the new `web/` directory.

**Key UI implementations exist** for team creation, submissions, judging/evaluation, and disputes — however, most of these bypass the API layer by writing directly to Supabase via the browser client. This is the single most dangerous architectural pattern in the codebase.

### Critical Findings Summary

| Priority | Count | Categories |
|----------|-------|------------|
| **Critical** | 8 | Security, financial workflow, mutation bypass |
| **High** | 14 | Missing features, broken workflows, UX gaps |
| **Medium** | 20 | Polish, optimization, missing states |
| **Low** | 12 | Nice-to-haves, future enhancements |

---

## 1. Product Discovery Findings

### 1.1 Business Goals Assessment

The platform serves a clear niche: **trustless event prize distribution** using blockchain escrow. The business model relies on organizers trusting the platform to custody and distribute funds fairly. This requires exceptional transparency, security, and workflow completeness.

**Tech Stack (Verified):**
- Frontend/Backend: Next.js 16.2.10 (App Router), React 19.2.4
- Database: Supabase PostgreSQL with RLS
- Auth: Supabase Auth (cookie-based SSR via `@supabase/ssr` 0.12.3)
- Blockchain: `@stellar/stellar-sdk` v16.0.1, `@stellar/freighter-api` v6.0.1
- Validation: Zod 4.4.3
- Email: Resend v4.1.2
- Testing: Vitest + fast-check (property-based)
- Styling: Tailwind CSS 4.3.3 with CSS custom properties

### 1.2 Missing Product Capabilities (Verified)

| # | Missing Capability | Evidence | Priority |
|---|---|---|---|
| 1 | **No landing page / marketing page** | `web/app/page.tsx` contains only a redirect: authenticated → `/dashboard`, unauthenticated → `/login`. Zero value proposition for visitors. | Critical |
| 2 | **No password reset flow (Next.js app)** | The legacy Express codebase has `server/routes/auth.ts` with full reset flow + `src/pages/ResetPassword.tsx`. But the new `web/app/(auth)/` directory has NO reset page, no `/api/auth/reset-password` route. Supabase Auth has built-in reset but it's not wired up. | Critical |
| 3 | **No auth callback route for email verification** | Signup page shows "Check your email" after registration, but there is no `web/app/(auth)/callback` or `web/app/auth/confirm` route to handle the Supabase email confirmation redirect. Users who click the link get a 404. | Critical |
| 4 | **No invitation acceptance page** | `web/app/api/workspaces/[slug]/invitations/route.ts` creates invitations but no `/invitations/[token]` page exists for accepting them. The workspace members page says "Member invitation via email is coming soon." | High |
| 5 | **No public event detail page** | All event detail routes are under `/(app)/` which requires authentication. The discover page links to events but unauthenticated users can't view details. | High |
| 6 | **No sponsor management UI** | API endpoint exists (`/api/events/[id]/sponsors`) but no frontend form for adding/managing sponsors. | High |
| 7 | **No milestone management UI** | Same pattern — API exists (`/api/events/[id]/milestones`), no UI. | High |
| 8 | **No winner SELECTION UI** | `web/app/(app)/events/[id]/winners/page.tsx` exists but is **read-only** — it displays winners. No interface for organizers to select/assign winners or allocate prize amounts. | High |
| 9 | **No member approval/rejection workflow** | Permission matrix defines `approve`/`reject` actions. But the event members tab (in `event-detail-client.tsx`) has no approve/reject buttons. Members stay in "pending" forever. | High |
| 10 | **No profile editing** | Settings page at `web/app/(app)/settings/page.tsx` displays wallets (with connect/remove) but no profile name/bio editing form. | Medium |
| 11 | **No disbursement/refund trigger in UI** | API endpoints `/api/events/[id]/disburse` and `/api/events/[id]/refund` exist but the escrow page has no buttons to trigger them. | High |
| 12 | **No event duplication/template** | Organizers must recreate events from scratch every time. | Medium |
| 13 | **No bulk participant actions** | No multi-select for batch approval/rejection of members. | Medium |
| 14 | **No export functionality** | No way to export participant lists, submissions, or results. | Medium |
| 15 | **No workspace invitation UI (functional)** | Members page shows "coming soon" placeholder. | High |

### 1.3 UIs That EXIST (Correcting Prior Claims)

| Feature | File | Status | Caveat |
|---------|------|--------|--------|
| Team creation | `web/app/(app)/events/[id]/teams/page.tsx` | ✅ Functional | Bypasses API — inserts directly via browser Supabase client |
| Submission creation | `web/app/(app)/events/[id]/submissions/page.tsx` | ✅ Functional | Bypasses API — inserts directly via browser Supabase client |
| Judging/evaluation scoring | `web/app/(app)/events/[id]/judging/page.tsx` | ✅ Functional | ✅ Properly uses API route (`POST /api/events/[id]/evaluations`) |
| Dispute filing | `web/app/(app)/events/[id]/disputes/page.tsx` | ✅ Functional | ✅ Properly uses API route (`POST /api/disputes`) |
| Escrow viewing + on-chain verification | `web/app/(app)/events/[id]/escrow/page.tsx` | ✅ Partial | Verify works. Fund button = `alert()` placeholder only. |
| Registration flow | `web/app/(app)/events/[id]/register/page.tsx` | ✅ Exists | — |
| Workspace settings editing | `web/app/(app)/workspaces/[slug]/settings/page.tsx` | ✅ Functional | Uses API route properly |

### 1.4 Missing User Journeys

| Journey | Current State | Gap |
|---------|--------------|-----|
| **First-time visitor** | Redirect to login. No value proposition. | Need landing page with social proof, feature overview, CTA |
| **Sponsor joining** | No self-service sponsor flow | Need sponsor application/invitation + contribution page |
| **Judge onboarding** | Added via `event_members` table | No judge-specific onboarding or rubric explanation |
| **Team join request** | Teams page allows creation but no join/invite mechanism | Need team invite + join request flow |
| **Submission revision** | `submission_versions` table exists in schema | No UI for viewing version history or creating revisions |
| **Winner notification & claim** | System notification created | No dedicated "You won!" experience with claim instructions |
| **Prize claim by winners without wallets** | "held" status recorded | No flow guiding unverified winners to connect wallet and claim |
| **Password recovery** | Legacy Express app has it; Next.js app does not | Need Supabase Auth password reset page |

---

## 2. UX/UI Audit Report

### 2.1 Information Architecture Issues

| Issue | Severity | Details |
|-------|----------|---------|
| **Navigation inconsistency** | High | Desktop nav links to `/discover`, `/dashboard`, `/events/new`. No link to `/workspaces`, `/admin`, or `/profile`. These are reachable only through dashboard or direct URL. |
| **No breadcrumbs on most pages** | Medium | `breadcrumbs.tsx` component exists but is underutilized. Deep pages have no navigation context. |
| **Dead nav link: "Docs"** | Medium | Footer links "Docs" to `/discover` which is not documentation. |

### 2.2 Design System Consistency Issues

| Issue | Severity | Details | Evidence |
|-------|----------|---------|----------|
| **Mixed styling approaches** | High | Auth pages use hardcoded Tailwind (`bg-neutral-900`, `border-neutral-300`). App pages use CSS custom properties (`var(--text)`, `var(--border)`). Theme changes won't propagate to auth pages. | `web/app/(auth)/login/page.tsx` vs `web/app/(app)/` pages |
| **Create event page ignores theme** | High | Hardcoded `bg-neutral-900`, `text-neutral-500`, `border-neutral-300` — will break in dark mode. | `web/app/(app)/events/new/page.tsx` |
| **Discover page ignores theme** | High | Uses hardcoded `border-neutral-200`, `text-neutral-500`, `bg-neutral-100`. | `web/app/(public)/discover/page.tsx` |
| **Inconsistent button patterns** | Medium | Some pages use `btn-primary` class, others use inline `bg-neutral-900` or `bg-[var(--btn-primary-bg)]`. |

### 2.3 Accessibility (WCAG) Issues

| Issue | Severity | WCAG Criterion |
|-------|----------|----------------|
| **No skip-to-content link** | High | 2.4.1 Bypass Blocks |
| **Mobile menu toggle uses emoji text** | High | `"✕"` and `"☰"` have no `aria-label`. | 1.1.1 Non-text Content |
| **Forms missing required field indicators** | Medium | 3.3.2 Labels or Instructions |
| **No focus management on tab switch** | Medium | Event detail tabs don't move focus to content. | 2.4.3 Focus Order |
| **Color contrast unverified** | Medium | CSS custom properties mean contrast depends on runtime theme values. | 1.4.3 Minimum Contrast |
| **No keyboard trap handling in dropdowns** | Medium | Profile dropdown doesn't trap focus or close on Escape. | 2.1.2 No Keyboard Trap |
| **No aria-live regions for notifications** | Medium | Bell icon and notification list don't announce changes to screen readers. | 4.1.3 Status Messages |

### 2.4 Missing UI States

| Page/Component | Missing State | Priority |
|----------------|--------------|----------|
| **Event Detail - Settings tab** | No confirmation dialog for state transitions (uses bare `confirm()`) | High |
| **Event Detail - Settings tab** | No undo/rollback after accidental state change | High |
| **Escrow page** | "Fund Escrow" just shows an `alert()` — no actual wallet signing flow | Critical |
| **Discover page** | No pagination — hardcoded `.limit(20)`, no "Load More" or paging | High |
| **Dashboard** | Capped at fixed event count with no "View all" | Medium |
| **Notifications** | No filter by category or read/unread | Medium |
| **All forms** | No autosave / draft recovery | Medium |

### 2.5 Mobile Responsiveness Issues

| Issue | Severity |
|-------|----------|
| Event detail tabs can overflow on mobile (no scroll indicator) | Medium |
| Create event form uses `grid-cols-2` without responsive collapse | Medium |
| Escrow page may overflow with long Stellar public keys on small screens | Medium |

---

## 3. Workflow & Lifecycle Audit

### 3.1 Event Lifecycle (16 States)

**State Machine (Verified in `web/types/enums.ts`):**
Draft → Published → RegistrationOpen → RegistrationClosed → TeamFormation → SubmissionOpen → SubmissionClosed → Judging → ReviewObjectionWindow → WinnersFinalized → OrganizerFundsEscrow → EscrowLocked → PrizeDistribution → Completed | Cancelled | Archived

**Critical Gaps:**

| Gap | Severity | Evidence |
|-----|----------|----------|
| **State transitions from frontend bypass state machine** | Critical | `event-detail-client.tsx` line ~54: `handleStateChange()` directly calls `supabase.from("events").update({ state: newState })` without calling `canTransition()`. This means preconditions (e.g., all evaluations submitted, team sizes valid) are NOT checked. |
| **No approval workflow for member applications** | High | Members apply with `status: "pending"` but the members tab in event-detail has no approve/reject buttons. Events can progress with pending members. |
| **No automated transition from Judging → ReviewObjectionWindow** | Medium | No "all evaluations submitted" detection triggers the transition. Relies on organizer manual action. |
| **Review window expiry not enforced** | High | `review_window_hours` is stored (default 72h) but no scheduled job transitions the event out of ReviewObjectionWindow after expiry. |
| **UI shows limited transition buttons** | Medium | Settings tab only shows transitions up to Judging. States after SubmissionClosed have no UI buttons. |
| **Cancellation from any state** | Medium | "Cancel Event" button is always shown with a bare `confirm()` dialog, doesn't check if cancellation is valid from current state. |

### 3.2 Escrow Workflow Gaps

| Gap | Severity | Evidence |
|-----|----------|----------|
| **Funding flow is non-functional** | Critical | `escrow/page.tsx` line ~147: `onClick={() => alert("Funding flow: Sign transaction...")}`. No wallet signing, no API call to `/api/events/[id]/fund`. |
| **No link between event state and escrow state** | High | Event transitions to "OrganizerFundsEscrow" but nothing triggers escrow account creation automatically. |
| **No disbursement trigger in UI** | High | `/api/events/[id]/disburse` endpoint exists but escrow page has no "Disburse" button. |
| **No refund trigger in UI** | High | `/api/events/[id]/refund` exists with no frontend access. |
| **Reconciliation not triggered periodically** | Medium | `reconcileEscrow` function exists but no cron job or UI trigger calls it. |

### 3.3 KMS / Secret Key Storage (CORRECTED from v1.0)

**Previous claim:** "Secret key stored as base64, not encrypted."  
**Actual finding:** The `web/lib/services/kms.ts` file implements **envelope encryption**:

- **Production path (`KMS_KEY_ARN` set):** Calls AWS KMS `TrentService.Encrypt` API. The plaintext is sent base64-encoded to KMS (standard AWS pattern — KMS returns encrypted CiphertextBlob). This is proper KMS encryption.
- **Development fallback (no `KMS_KEY_ARN`):** Uses XOR-based obfuscation with a hardcoded key (`"dev-only-key-never-use-in-production-32b"`). Explicitly logged as "NOT suitable for production."

**Remaining concerns:**
| Issue | Severity |
|-------|----------|
| KMS stub doesn't include AWS SigV4 authentication — will fail against real KMS | High |
| XOR obfuscation for dev is reversible (same as no encryption for local dev compromise) | Medium |
| No `@aws-sdk/client-kms` in dependencies — production path would fail at runtime | High |
| No key rotation mechanism | Medium |

### 3.4 Team Formation Workflow Gaps

| Gap | Severity | Evidence |
|-----|----------|----------|
| **Team creation exists but bypasses API** | High | `teams/page.tsx` inserts directly into `teams` + `team_members` via browser client. No server-side validation, no audit record. |
| No join request flow | High | Participants can't request to join existing teams. |
| No team captain invite flow | High | Captains can't invite specific users to their team. |
| No team size validation in UI | Medium | DB enforces `team_size_min`/`team_size_max` via CHECK but no client-side feedback before hitting constraint. |

### 3.5 Judging Workflow (Partially Complete)

| Feature | Status | Evidence |
|---------|--------|----------|
| Scoring interface for judges | ✅ Exists | `judging/page.tsx` — 3 criteria (Innovation, Technical, Impact), 0-100 scale, feedback |
| API route for evaluation submission | ✅ Works | `POST /api/events/[id]/evaluations` with CoI checking |
| Conflict-of-interest detection | ✅ Backend | `evaluation.ts` service rejects if judge is on submitting team |
| Score aggregation/ranking display | ❌ Missing | Winners page is read-only, no leaderboard |
| Judge assignment interface | ❌ Missing | No way to assign judges to specific submissions |
| Configurable rubric per event | ❌ Missing | Hardcoded 3 criteria (Innovation/Technical/Impact) |

### 3.6 Dispute Workflow (Partially Complete)

| Feature | Status | Evidence |
|---------|--------|----------|
| File dispute form | ✅ Exists | `disputes/page.tsx` — text-only reason submission via API |
| View disputes list | ✅ Exists | Shows state, filer name, reason, date |
| Evidence upload | ❌ Missing | `dispute_evidence` table in schema, no upload UI or API |
| Resolution interface for organizers | ❌ Missing | `transitionDispute` service exists, no frontend |
| Dispute timeline view | ❌ Missing | No chronological view of state changes |

---

## 4. Database & Backend Audit

### 4.1 Schema Assessment (14 Migrations Verified)

**Migration files in `web/supabase/migrations/`:**
1. `000001` — Extensions (uuid-ossp, pgcrypto)
2. `000002` — Users, wallets
3. `000003` — Workspaces, workspace_members
4. `000004` — Events, event_members (with mutual exclusion index Judge/Participant)
5. `000005` — Escrow accounts, transactions
6. `000006` — Teams, team_members, submissions, submission_versions
7. `000007` — Evaluations, winners
8. `000008` — Disputes (state machine: Open → UnderReview → Upheld/Dismissed/Escalated)
9. `000009` — Idempotency keys, audit_records (append-only)
10. `000010` — Notifications (realtime publication)
11. `000011` — Sponsors, milestones, invitations, legal_acceptances
12. `000012` — RLS policies (comprehensive)
13. `000013` — Schema alignment (FTS trigger, additional indexes)
14. Files and evidence tables

**Strengths:**
- Well-normalized schema with proper foreign keys and CHECK constraints
- Version columns for optimistic concurrency on mutable resources
- GIN full-text index for event search (trigger-maintained `fts` column)
- Partial unique indexes (judge/participant exclusion, one team per participant per event)
- Append-only enforcement on `audit_records` (no UPDATE/DELETE grants)
- RLS enabled with comprehensive policies
- Event state CHECK constraint mirrors exactly 16 canonical states

**Missing Tables/Entities:**

| Entity | Purpose | Priority |
|--------|---------|----------|
| `webhook_endpoints` | Referenced in `webhook.ts` service but NO migration creates it | High |
| `user_preferences` | Email digest frequency, notification preferences | Medium |
| `event_rubrics` / `evaluation_criteria` | Structured judging criteria per event (currently hardcoded) | Medium |
| `team_join_requests` | Self-service team join flow | Medium |

### 4.2 API Route Coverage (Verified)

**Existing API Routes (under `web/app/api/`):**

| Route | Methods | Status |
|-------|---------|--------|
| `/api/health`, `/api/health/ready` | GET | ✅ |
| `/api/auth/wallet/challenge` | POST | ✅ |
| `/api/auth/wallet/verify` | POST | ✅ |
| `/api/events` | GET, POST | ✅ |
| `/api/events/[id]/activity` | GET | ✅ |
| `/api/events/[id]/audit` | GET | ✅ |
| `/api/events/[id]/disburse` | POST | ✅ |
| `/api/events/[id]/evaluations` | GET, POST | ✅ |
| `/api/events/[id]/fund` | POST | ✅ |
| `/api/events/[id]/members` | GET, POST, PATCH, DELETE | ✅ |
| `/api/events/[id]/milestones` | GET, POST | ✅ |
| `/api/events/[id]/refund` | POST | ✅ |
| `/api/events/[id]/register` | POST | ✅ |
| `/api/events/[id]/sponsors` | GET, POST | ✅ |
| `/api/events/[id]/state` | PATCH | ✅ |
| `/api/events/[id]/submissions` | GET, POST | ✅ |
| `/api/events/[id]/teams` | GET, POST | ✅ |
| `/api/events/[id]/transactions` | GET | ✅ |
| `/api/events/[id]/verify-escrow` | GET | ✅ |
| `/api/events/[id]/winners` | GET | ✅ |
| `/api/disputes` | GET, POST | ✅ |
| `/api/notifications` | GET, PATCH | ✅ |
| `/api/upload` | POST | ✅ |
| `/api/users/me` | GET, PATCH | ✅ |
| `/api/workspaces` | GET, POST | ✅ |
| `/api/workspaces/[slug]/members` | GET, POST, DELETE | ✅ |
| `/api/workspaces/[slug]/invitations` | GET, POST | ✅ |
| `/api/v1/events` | GET | ✅ |
| `/api/cron` | POST | ✅ |

**Missing Endpoints:**

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `POST /api/auth/reset-password` (or use Supabase built-in) | Password reset | Critical |
| `GET /api/auth/callback` (route handler for email confirm) | Email verification redirect | Critical |
| `POST /api/events/[id]/winners` | Winner selection by organizers | High |
| `POST /api/events/[id]/teams/[teamId]/join` | Team join request | High |
| `POST /api/events/[id]/disputes/[disputeId]/evidence` | Evidence upload | High |
| `PATCH /api/events/[id]/disputes/[disputeId]` | Dispute resolution | High |
| `GET /api/events/[id]/leaderboard` | Aggregated scores/ranking | Medium |
| `GET /api/events/[id]/export` | Export participants/results | Low |

### 4.3 API Contract Issues (Critical Pattern)

| Issue | Severity | Evidence |
|-------|----------|---------|
| **Event creation bypasses API route** | High | `events/new/page.tsx` calls `supabase.from("events").insert(...)` directly from browser. Bypasses API-level business logic, audit trail, rate limiting. |
| **State transitions bypass API** | Critical | `event-detail-client.tsx` calls `supabase.from("events").update({ state: newState })` directly. Bypasses `canTransition()` checks, preconditions, audit records, notifications, and permission matrix enforcement at API level. |
| **Member application bypasses API** | High | `handleApply` in event-detail inserts directly to `event_members` via browser client. No server-side validation that user meets registration criteria. |
| **Team creation bypasses API** | High | `teams/page.tsx` inserts into `teams` + `team_members` directly. No team size validation against event rules, no audit. |
| **Submission creation bypasses API** | High | `submissions/page.tsx` inserts directly. No event-state check server-side, no file validation. |
| Wallet removal via client-side RLS only | Medium | Settings page deletes wallets directly. No server-side check that wallet isn't used in pending disbursements. |

**Good patterns (use these as the model):**
- Judging/evaluation → `POST /api/events/[id]/evaluations` ✅
- Dispute filing → `POST /api/disputes` ✅
- Workspace settings → `PATCH /api/workspaces/[slug]` ✅

---

## 5. Security Review

### 5.1 Critical Security Issues

| Issue | Severity | Evidence | Recommendation |
|-------|----------|----------|----------------|
| **CSP nonce is a static string** | Critical | `middleware.ts` line ~57: `"'self' 'nonce-csp'"` — this is a hardcoded literal string, NOT a per-request cryptographic nonce. Any XSS payload with `nonce="csp"` bypasses CSP entirely. | Generate per-request `crypto.randomUUID()` nonce, inject into both CSP header and `<script>` tags. |
| **State transitions from frontend bypass authorization** | Critical | `event-detail-client.tsx`: Any authenticated user with RLS `SELECT`/`UPDATE` permission can potentially change event state directly. Defense-in-depth requires the API-layer `canTransition()` + permission matrix check. | Remove all direct browser-client mutations. Route through API routes exclusively. |
| **In-memory rate limiter resets on deployment** | High | `middleware.ts` line ~85: `const rateLimitStore = new Map<string, ...>()` — lost on every serverless cold start or redeployment. Brute force protection is unreliable. | Use Redis/Upstash or Supabase-based rate limiting (persistent store). |
| **Admin page has no role verification** | High | `admin/page.tsx` checks `if (!user) redirect("/login")` but does NOT verify the user has `PlatformAdmin` role. Any authenticated user can access admin KPIs. | Add role check: query user's platform role and reject non-admins. |
| **No audit trail for client-side mutations** | High | Events, members, teams, and submissions created/modified via browser client leave NO audit record (the audit service is only called in API route handlers). | Route all mutations through API endpoints with audit service integration. |
| **KMS integration is a stub** | High | `kms.ts` uses raw `fetch()` to AWS KMS without SigV4 authentication headers. No `@aws-sdk/client-kms` in dependencies. Production path would fail at runtime. | Install `@aws-sdk/client-kms`, implement proper authenticated calls. |
| **No account lockout after failed login attempts** | Medium | Rate limiter helps at the IP level but doesn't lock specific accounts after N failures. | Implement progressive delay or temporary lockout per email address. |
| **PUBLIC_PREFIXES too broad** | Medium | `middleware.ts`: `"/api/events/"` prefix makes ALL event sub-routes bypass auth at the middleware level. Route-level handlers catch this, but it creates a layered-security gap if a handler is misconfigured. | Narrow to specific public paths: `/api/events` (GET only) and `/api/events/[id]/verify-escrow`. |

### 5.2 Authentication & Authorization Gaps

| Issue | Severity | Details |
|-------|----------|---------|
| No password reset in Next.js app | Critical | Only exists in legacy Express codebase |
| No auth/callback route for email confirmation | Critical | Supabase sends email but redirect target doesn't exist |
| No 2FA/MFA support | Medium | Financial platform handling cryptocurrency should offer MFA |
| Legal acceptance not enforced at middleware level | Medium | `requireLegalAcceptance` is called in individual endpoints — easy to miss |
| No session revocation | Medium | Users can't see active sessions or revoke them |

### 5.3 Positive Security Findings

| Feature | Status | Evidence |
|---------|--------|---------|
| HSTS header | ✅ | `max-age=63072000; includeSubDomains; preload` |
| X-Frame-Options | ✅ | `DENY` |
| X-Content-Type-Options | ✅ | `nosniff` |
| Referrer-Policy | ✅ | `strict-origin-when-cross-origin` |
| Permissions-Policy | ✅ | Camera, mic, geo disabled |
| Request ID tracing | ✅ | `X-Request-Id` header on every response |
| Idempotency on financial ops | ✅ | DB-level unique constraint + stored response |
| Wallet ownership verification | ✅ | Challenge-response with Freighter signing |
| CoI detection in evaluations | ✅ | Backend rejects judge scoring own team |
| Optimistic concurrency | ✅ | Version column prevents lost-update races |
| RLS as second enforcement layer | ✅ | Comprehensive policies on all tables |
| Append-only audit records | ✅ | No UPDATE/DELETE grants + trigger enforcement |

---

## 6. Architecture Review

### 6.1 Strengths

- **Clean layered architecture**: Routes → Services → Database with clear separation
- **Shared state machine**: Pure TypeScript module (`web/lib/state-machine/`) usable server + client
- **Typed error hierarchy**: Maps to HTTP status codes with consistent envelope response
- **Idempotency service**: Proper DB-backed implementation for financial operations
- **Property-based tests**: fast-check integrated with Vitest (100+ iteration configs)
- **Optimistic concurrency**: Version columns prevent lost-update race conditions
- **Defense-in-depth design**: Permission matrix at API + RLS at database level
- **Comprehensive migrations**: 14 migrations with proper up/down, indexes, CHECK constraints

### 6.2 Architecture Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| **Client-side mutations bypassing API layer** | Critical | 5 pages write directly to Supabase via browser client: event creation, state changes, member applications, team creation, submission creation. Creates two mutation paths: one audited (API), one unaudited (direct). |
| **No service-layer error boundaries** | High | If `writeAuditRecord` or `createNotification` fails, the primary operation still succeeds but side-effects are silently lost. No dead-letter queue or retry. |
| **Webhook table doesn't exist** | High | `webhook.ts` service references `webhook_endpoints` table that has no migration. Service would throw at runtime. |
| **Legacy codebase still present** | Medium | Root `package.json` still has Express, better-sqlite3, Vite, react-router-dom. Creates confusion about which is the "real" app. |
| **No background job infrastructure** | Medium | Scheduled jobs rely on external cron hitting `/api/cron`. No dead-letter, no observability, no retry tracking. |
| **No feature flags** | Medium | Design mentions "per-workspace feature flags" but none are implemented. |
| **KMS stub requires AWS SDK not in deps** | High | Production encryption path will fail — `@aws-sdk/client-kms` is not installed. |

### 6.3 Scalability Concerns

| Concern | Impact | Recommendation |
|---------|--------|----------------|
| In-memory rate limiter | Won't work across serverless instances | Use Upstash Redis |
| Discover page fetches all events per request | N+1 potential, no caching | Add ISR or SWR caching layer |
| No pagination on discover | Hardcoded `.limit(20)` with no "next page" | Implement cursor-based pagination |
| Realtime subscription per-user | May hit Supabase realtime connection limits | Consider aggregation channels |

---

## 7. Feature Gap Analysis (vs. Modern SaaS Standards)

### 7.1 Expected Features — Absent

| Feature | Industry Standard | Current State | Priority |
|---------|------------------|---------------|----------|
| **Activity timeline on event pages** | All SaaS platforms show chronological activity feeds | API exists (`/api/events/[id]/activity`), no UI component renders it | High |
| **Comments/discussions** | GitHub, Linear, Notion all support threaded comments | No comment system on events, submissions, or disputes | High |
| **File attachments on submissions** | Standard for hackathon platforms | `submission_files` / evidence tables exist, no upload UI in submission flow | High |
| **Saved drafts / autosave** | Google Docs, Notion, Linear | No draft persistence. Form data lost on navigation. | Medium |
| **Bulk actions** | All admin/management tools | No multi-select for approving members, assigning winners, etc. | Medium |
| **CSV/PDF export** | Standard reporting feature | No participant/result export UI | Medium |
| **Search within workspace** | Slack, Linear, Notion | Only discover page has search. No search within "My Events" or workspace. | Medium |
| **Webhooks management UI** | GitHub, Stripe | Service exists but no table + no UI | Medium |
| **Event templates** | Eventbrite, Devpost | No way to save and reuse event configurations | Low |
| **Participant analytics** | Devpost, HackerEarth | No registration funnel, engagement metrics, or completion rates | Medium |

### 7.2 Competitive Gap (vs. Devpost, HackerEarth, Gitcoin)

| Competitor Feature | Stellar Guardian Status |
|-------------------|----------------------|
| Public event listing with rich cards | Partial (basic grid, no images/organizer info) |
| Registration countdown timer | Missing |
| Team matching / "Looking for Teammates" | Missing |
| Submission gallery (public showcase) | Missing |
| Judge dashboard with pending evaluations queue | ✅ Exists (judging page shows scored/unscored) |
| Prize breakdown visualization | Missing |
| Participant certificates | Missing |
| Event analytics dashboard for organizers | Missing |
| Social sharing (Open Graph meta) | Missing |
| Sponsor logo/tier display | Missing |

---

## 8. Prioritized Recommendations

### Critical (Must Fix Before Any Production Use)

| # | Issue | Solution | Complexity | Verified Source |
|---|-------|----------|------------|----------------|
| C1 | CSP nonce is static string | Generate per-request `crypto.randomUUID()` nonce in middleware, pass via `x-nonce` header to layout | Low | `middleware.ts:57` |
| C2 | State transitions bypass state machine from frontend | Remove direct browser-client `events.update()` in `event-detail-client.tsx`; call `PATCH /api/events/[id]/state` which already exists and validates via `canTransition()` | Medium | `event-detail-client.tsx:54` |
| C3 | No password reset (Next.js app) | Wire up Supabase Auth `resetPasswordForEmail()` + create `/(auth)/reset-password` page | Low | Missing from `web/app/(auth)/` |
| C4 | No auth callback for email verification | Create `web/app/(auth)/callback/route.ts` to handle Supabase email confirmation redirect | Low | No callback route exists |
| C5 | Admin page has no role check | Query user's role from `workspace_members` or `users` table; redirect non-admins | Low | `admin/page.tsx:11` |
| C6 | Funding flow non-functional | Build wallet-signing flow: Freighter `signTransaction()` → submit to Horizon → call `/api/events/[id]/fund` with tx hash | High | `escrow/page.tsx:147` |
| C7 | In-memory rate limiter | Replace `Map` with Upstash Redis `@upstash/ratelimit` or Supabase-backed token bucket | Medium | `middleware.ts:85` |
| C8 | KMS stub missing AWS SDK | Install `@aws-sdk/client-kms`, replace raw fetch with proper `KMSClient.send(EncryptCommand)` | Medium | `kms.ts` |

### High Priority (Required for Beta)

| # | Issue | Solution | Complexity |
|---|-------|----------|------------|
| H1 | Event creation bypasses API | Refactor `events/new/page.tsx` to `POST /api/events` (endpoint already exists) | Medium |
| H2 | Team creation bypasses API | Refactor `teams/page.tsx` to `POST /api/events/[id]/teams` (endpoint exists) | Low |
| H3 | Submission creation bypasses API | Refactor `submissions/page.tsx` to `POST /api/events/[id]/submissions` (endpoint exists) | Low |
| H4 | Member application bypasses API | Refactor `handleApply` to `POST /api/events/[id]/register` (endpoint exists) | Low |
| H5 | No winner selection UI | Build organizer interface to assign winners + prize amounts → `POST /api/events/[id]/winners` | Medium |
| H6 | No member approval workflow | Add approve/reject buttons in event members tab → `PATCH /api/events/[id]/members` | Medium |
| H7 | No landing page | Build marketing/conversion page at `/` for unauthenticated users | Medium |
| H8 | No public event detail page | Create `/(public)/events/[id]` with limited info + "Login to participate" CTA | Low |
| H9 | Theme inconsistency | Refactor login, signup, create-event, discover to use CSS custom properties | Medium |
| H10 | No disbursement/refund UI triggers | Add action buttons on escrow page when event state allows | Medium |
| H11 | No invitation acceptance page | Build `/(public)/invitations/[token]` acceptance flow | Low |
| H12 | Webhook table missing | Create migration for `webhook_endpoints` table | Low |
| H13 | `PUBLIC_PREFIXES` too broad | Narrow `/api/events/` prefix to specific public sub-routes | Low |
| H14 | No pagination on discover page | Add cursor-based "Load More" using existing discovery query | Low |

### Medium Priority (Post-Beta Polish)

| # | Issue | Solution | Complexity |
|---|-------|----------|------------|
| M1 | No profile editing | Add display name, avatar, bio edit form in settings (already has `PATCH /api/users/me`) | Low |
| M2 | No activity timeline UI | Build chronological feed component using `/api/events/[id]/activity` | Medium |
| M3 | No configurable judging rubrics | Add `evaluation_criteria` table + per-event criteria management | Medium |
| M4 | No dispute resolution interface | Build organizer view with Uphold/Dismiss/Escalate buttons | Medium |
| M5 | No evidence upload for disputes | Build file upload on dispute detail page | Medium |
| M6 | No team join requests | Add join button on teams page + approval flow for captains | High |
| M7 | No search within "My Events" | Add client-side filter or server-side search on dashboard | Low |
| M8 | Members shown as UUIDs in some views | Join `display_name` in member queries (some views already do this) | Low |
| M9 | No breadcrumbs on most pages | Extend existing `breadcrumbs.tsx` component to all nested pages | Low |
| M10 | No event duplication | Add "Duplicate" button that prefills create-event form | Low |
| M11 | No bulk member approval | Add multi-select + batch approve/reject | Medium |
| M12 | No export functionality | Add CSV export for participants, results, transactions | Medium |
| M13 | No comments on submissions | Build comment system (table + API + UI) | High |
| M14 | No Open Graph / social meta | Add dynamic OG images and meta tags for event pages | Medium |
| M15 | Form autosave | Implement localStorage-based draft persistence | Medium |
| M16 | No skip-to-content link | Add hidden skip link at top of layout | Low |
| M17 | Dropdown focus management | Implement focus trap and Escape key handler on profile dropdown | Low |
| M18 | No 2FA support | Enable Supabase MFA for sensitive accounts | Medium |
| M19 | No sponsor logo display | Add sponsor tier/branding to event pages | Medium |
| M20 | Review window auto-expiry | Add cron job to auto-transition after `review_window_hours` | Medium |

### Low Priority (Future Enhancements)

| # | Issue | Solution |
|---|-------|----------|
| L1 | No i18n / multi-language | Implement `next-intl` or similar |
| L2 | No participant certificates | Generate PDF certificates for completed events |
| L3 | No mentor matching | Add mentor role flow |
| L4 | No event templates | Save/load event configurations |
| L5 | No API versioning strategy | Define deprecation timeline |
| L6 | No feature flags | Implement per-workspace feature flag system |
| L7 | No email marketing | Add announcement/broadcast to participants |
| L8 | No session management UI | Show active sessions + revocation |
| L9 | No submission gallery | Public showcase of completed submissions |
| L10 | No judge assignment algorithm | Automated fair distribution |
| L11 | No webhook management UI | CRUD interface for workspace webhooks |
| L12 | Dead "Docs" footer link | Replace with actual docs or remove |

---

## 9. Implementation Roadmap

### Phase 1: Security & Critical Fixes (1 week)

**Goal:** Eliminate all Critical severity issues. No user-facing features — pure hardening.

| Task | Issue | Effort | Dependencies |
|------|-------|--------|--------------|
| Fix CSP nonce generation | C1 | 2h | None |
| Route state transitions through API | C2 | 4h | API route `/api/events/[id]/state` already exists |
| Create auth callback route | C4 | 2h | Supabase project email settings |
| Add password reset page | C3 | 4h | Supabase `resetPasswordForEmail` |
| Add admin role gate | C5 | 1h | None |
| Replace in-memory rate limiter | C7 | 4h | Upstash Redis account |
| Install `@aws-sdk/client-kms` + fix KMS | C8 | 4h | AWS account with KMS key |
| Narrow `PUBLIC_PREFIXES` | H13 | 1h | None |

### Phase 2: Mutation Consolidation (1 week)

**Goal:** All writes go through audited API routes. This is the #1 architectural debt.

| Task | Issue | Effort | Dependencies |
|------|-------|--------|--------------|
| Refactor event creation to use API | H1 | 3h | None |
| Refactor team creation to use API | H2 | 2h | None |
| Refactor submission creation to use API | H3 | 2h | None |
| Refactor member application to use API | H4 | 2h | None |
| Add webhook_endpoints migration | H12 | 1h | None |
| Verify all browser-client writes eliminated | — | 2h | Above tasks |

### Phase 3: Core Workflow Completion (2 weeks)

**Goal:** Complete the financial and lifecycle workflows that are currently broken.

| Task | Issue | Effort | Dependencies |
|------|-------|--------|--------------|
| Build funding flow (Freighter → Horizon → API) | C6 | 8h | Stellar testnet, wallet adapter |
| Build winner selection UI | H5 | 6h | Winner API endpoint (create `POST`) |
| Build member approval workflow | H6 | 4h | `PATCH /api/events/[id]/members` |
| Build disbursement/refund UI triggers | H10 | 4h | Endpoints exist |
| Add complete lifecycle transition buttons | — | 4h | State machine validation |
| Build dispute resolution interface | M4 | 6h | `transitionDispute` service exists |

### Phase 4: Product Completeness (2 weeks)

**Goal:** Address all High-priority product gaps.

| Task | Issue | Effort | Dependencies |
|------|-------|--------|--------------|
| Build landing page | H7 | 8h | Design decision |
| Build public event detail page | H8 | 4h | None |
| Fix theme inconsistency across all pages | H9 | 6h | None |
| Build invitation acceptance page | H11 | 3h | None |
| Add discover page pagination | H14 | 3h | None |
| Build activity timeline UI | M2 | 6h | Activity API exists |
| Build team join request flow | M6 | 8h | New table + API |

### Phase 5: Polish & Enhancement (2-4 weeks)

**Goal:** Medium-priority items. Post-beta improvements.

Focus areas:
1. Profile editing, configurable rubrics, evidence upload
2. Comments system, export functionality, bulk actions
3. Accessibility fixes (skip-to-content, focus management)
4. Social meta, sponsor display, analytics dashboard
5. Review window auto-expiry, 2FA support

---

## 10. Technical Debt Summary

| Category | Items | Severity | Quick Fix? |
|----------|-------|----------|------------|
| Direct browser-client mutations (bypass API) | 5 instances (event create, state change, member apply, team create, submission create) | Critical | Yes — API routes already exist for all 5 |
| Static CSP nonce | 1 | Critical | Yes — 30min fix |
| Admin page no role check | 1 | High | Yes — 10min fix |
| KMS production path non-functional | 1 | High | Medium — needs AWS SDK install |
| In-memory state (rate limiter) | 1 | High | Medium — needs external service |
| Missing database table for existing service | 1 (webhooks) | High | Yes — migration file |
| Hardcoded styling ignoring theme system | 3 pages | High | Yes — CSS variable refactor |
| Legacy codebase in repo root | Express/SQLite/Vite still present | Medium | Cleanup sprint |
| `PUBLIC_PREFIXES` too broad | 1 | Medium | Yes — 10min fix |

---

## 11. Completeness Assessment

### What's Done Well (Infrastructure: ~85% complete)
- State machine (16 states + transition rules + preconditions)
- Permission matrix (6 roles × 12 resources × 6 actions)
- Typed error hierarchy → HTTP status mapping
- Idempotency service for financial operations
- Optimistic concurrency control
- Wallet challenge-response verification
- RLS policies (comprehensive)
- Property-based test infrastructure
- Comprehensive API route coverage (35+ endpoints)
- Supabase realtime integration foundation

### What's Missing (Product UX: ~60% complete)
- Financial flows (funding, disbursement, refund) — non-functional in UI
- Winner assignment — view-only, no management
- Member approval — no UI despite backend support
- Password reset / email verification — not wired in new app
- Landing page — zero acquisition funnel
- Dispute resolution — filing works, resolution doesn't
- Team joining — creation works, collaboration doesn't
- All direct-mutation pages — working but unsafe

### Risk Assessment

**If deployed today:**
1. ❌ **Financial risk:** Escrow keys use XOR in dev mode. No production KMS. Funding button is a no-op.
2. ❌ **Security risk:** Any user can access admin page. State can be corrupted from frontend. CSP is decorative.
3. ❌ **Data integrity risk:** 5 mutation paths bypass audit trail entirely.
4. ⚠️ **UX risk:** Users can't reset passwords, confirm emails, or complete financial workflows.
5. ✅ **Core logic:** State machine, permissions, and evaluation are solid.

---

## 12. Conclusion

Stellar Guardian 3.0 has **excellent architectural foundations** — the state machine design, service layer, permission matrix, typed error model, and property-based test infrastructure are well-engineered and production-worthy.

The conversion from Express/Vite to Next.js App Router is **substantially complete at the infrastructure level**. API routes exist for nearly every operation. The database schema is comprehensive with proper constraints and RLS.

**The critical gap is the wiring layer** — UI pages that bypass existing API routes and write directly to Supabase via the browser client. This is simultaneously the most dangerous issue AND the easiest to fix, because the correct API endpoints already exist for every case. The fix is mechanical: replace `supabase.from(...).insert(...)` with `fetch("/api/...")`.

**The #1 priority sequence before any production deployment:**
1. Fix CSP nonce (30 minutes)
2. Add admin role gate (10 minutes)
3. Route all 5 client-side mutations through existing API routes (1-2 days)
4. Replace in-memory rate limiter (half day)
5. Wire up Supabase Auth password reset + email callback (half day)
6. Fix KMS with real AWS SDK (half day)

After these 6 items (approximately 3-4 dev days), the platform's security posture goes from "cannot deploy" to "acceptable for beta." The remaining work is product completeness, not safety.

---

*End of Report — Version 2.0*  
*Generated via full codebase inspection. All findings verified against source files.*
