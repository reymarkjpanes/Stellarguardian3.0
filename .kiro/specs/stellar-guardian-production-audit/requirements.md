# Requirements Document

## Introduction

Stellar Guardian 3.0 is a production-grade, decentralised hackathon and event management platform built on Next.js 16, Supabase/PostgreSQL, and the Stellar/Soroban blockchain. The platform orchestrates the complete lifecycle of competitive events — from organiser creation through participant registration, team formation, project submission, judging, prize allocation, and trustless on-chain escrow disbursement.

This requirements document captures every functional, structural, and operational requirement needed to transform the existing codebase into a fully production-ready system. The audit covers all five user roles (Participant, Team Captain, Organiser, Judge, Platform Admin), the complete 16-state event lifecycle, CRUD completeness for every domain entity, UX quality standards, security and RBAC enforcement, and the Soroban smart-contract integration.

## Glossary

- **Platform**: The Stellar Guardian 3.0 web application and its associated Soroban smart contracts.
- **Event**: A hackathon, bounty, or grant programme managed on the Platform, identified by a UUID, progressing through the 16-state lifecycle.
- **Event_State_Machine**: The pure TypeScript module (`lib/state-machine/event.ts`) that governs all valid event state transitions.
- **Organiser**: A workspace member with the `Organizer` role who creates and manages an Event.
- **Participant**: A registered user with the `Participant` role in an Event.
- **Team_Captain**: A Participant who created or was assigned captainship of a Team.
- **Team**: A group of one or more Participants in an Event, identified by UUID, managed through the team lifecycle.
- **Judge**: An Event member with the `Judge` role who scores Submissions against a Rubric.
- **Submission**: A project artefact submitted by a Team (or solo Participant) during the SubmissionOpen phase.
- **Evaluation**: A Judge's scored assessment of a Submission, tracked through the EvaluationStateMachine.
- **Escrow**: A Soroban smart contract on the Stellar network holding an Event's prize pool.
- **Prize_Allocation_Batch**: A database record linking finalised winner rankings to specific XLM amounts for escrow disbursement.
- **Workspace**: A multi-tenant organisational container that owns Events.
- **RBAC**: Role-Based Access Control enforced server-side on every API route.
- **RLS**: Row-Level Security enforced by Supabase PostgreSQL policies.
- **EARS**: Easy Approach to Requirements Syntax (pattern-based requirement writing standard).
- **PBT**: Property-Based Testing using `fast-check`.
- **State_Transition**: A validated change from one Event_State or Evaluation state to another.
- **Soft_Delete**: A logical deletion that sets a `deleted_at` timestamp without removing the database row.
- **Idempotency_Key**: A client-supplied token preventing duplicate execution of write operations.

## Requirements

### Requirement 1: User Authentication and Onboarding

**User Story:** As a new user, I want to register, verify my email, and complete onboarding, so that I can participate in events on the Platform.

#### Acceptance Criteria

1. WHEN a user submits the signup form with a valid email and password meeting minimum complexity (8+ characters, 1 uppercase, 1 number), THE Platform SHALL create a Supabase Auth account and send a verification email.
2. WHEN a user clicks the email verification link, THE Platform SHALL mark the account as verified and redirect to the onboarding flow.
3. WHEN a user completes onboarding (display name, optional avatar, optional bio), THE Platform SHALL create a `users` record and redirect to the dashboard.
4. IF a user attempts to access any authenticated route before completing onboarding, THEN THE Platform SHALL redirect them to `/onboarding`.
5. THE Platform SHALL support password reset via a time-limited email link that expires after 1 hour.
6. WHEN a user submits a login form, THE Platform SHALL rate-limit failed attempts to 5 per 15 minutes per IP address before returning HTTP 429.
7. THE Platform SHALL support Stellar wallet-based authentication — WHEN a user connects a Freighter, Albedo, xBull, or LOBSTR wallet and signs a challenge, THE Platform SHALL link the wallet address to their account.
8. WHEN a wallet is linked, THE Platform SHALL store the public key in the `wallets` table and mark it as verified.
9. THE Platform SHALL enforce MFA guard on sensitive operations — WHEN the `mfa_required` flag is set on the workspace, THE Platform SHALL require TOTP verification before any escrow or prize-allocation action.

### Requirement 2: Workspace Management

**User Story:** As an event organiser, I want to create and manage a workspace, so that I can group my events and control who can organise them.

#### Acceptance Criteria

1. WHEN an authenticated user creates a workspace with a unique `slug` and `name`, THE Platform SHALL create a `workspaces` record and assign the creator the `Owner` role in `workspace_members`.
2. THE Platform SHALL enforce workspace slug uniqueness — WHEN a duplicate slug is submitted, THE Platform SHALL return HTTP 409 with a human-readable conflict message.
3. WHEN a Workspace Owner invites a user by email with a specified role (`WorkspaceAdmin`, `Organizer`, `Member`), THE Platform SHALL create an `invitations` record with `type = workspace`, a signed token, and an expiry of 7 days.
4. WHEN an invitee accepts a workspace invitation, THE Platform SHALL create a `workspace_members` record and invalidate the invitation token.
5. THE Platform SHALL provide full CRUD for Workspaces: Create, Read (detail + member list), Update (name, description, settings by Owner/WorkspaceAdmin), Soft Delete (Owner only, blocks if active Events exist).
6. WHEN a Workspace Owner removes a member, THE Platform SHALL remove the `workspace_members` record and revoke any active event-member roles within that workspace.
7. THE Platform SHALL enforce tenant isolation — WHEN any API route fetches workspace data, THE Platform SHALL verify the requesting user's `workspace_members` record before returning data.

### Requirement 3: Event Discovery and Public View

**User Story:** As a prospective participant, I want to browse and filter published events, so that I can find hackathons that match my interests before registering.

#### Acceptance Criteria

1. WHEN an unauthenticated user visits `/discover`, THE Platform SHALL display all Events with `state = Published` OR `state IN (RegistrationOpen, RegistrationClosed, TeamFormationLocked, SubmissionOpen)` and `visibility = public`.
2. THE Platform SHALL support filtering the discover list by `category`, `format`, `network_mode`, and `tags`.
3. THE Platform SHALL support full-text search on `title` and `description` using the `fts` vector column, returning results within 500ms for up to 10,000 events.
4. THE Platform SHALL paginate the discover list with a default page size of 20 and a maximum of 100 per request.
5. WHEN a user views an Event detail page at `/e/[id]`, THE Platform SHALL display the title, description, prize pool, team size constraints, registration deadline, and current state badge.
6. THE Platform SHALL generate Open Graph metadata for each public Event using the `/e/[id]/opengraph-image` route.
7. WHEN an Event is in `Draft` or `Cancelled` or `Archived` state, THE Platform SHALL return HTTP 404 for any unauthenticated request to its public detail page.
8. THE Platform SHALL display a registration status indicator — WHEN registration is open, THE Platform SHALL show the deadline countdown; WHEN closed, THE Platform SHALL show "Registration Closed."

### Requirement 4: Participant Registration and Application Flow

**User Story:** As a participant, I want to apply to an event, track my application status, and receive notifications at every step, so that I know whether I'm eligible to compete.

#### Acceptance Criteria

1. WHEN a registered user applies to an Event in `RegistrationOpen` state, THE Platform SHALL create an `event_members` record with `role = Participant` and `team_status = unassigned` and return a confirmation.
2. THE Platform SHALL prevent duplicate applications — WHEN a user who already has an `event_members` record for the Event submits another application, THE Platform SHALL return HTTP 409.
3. WHEN an Organiser approves an application, THE Platform SHALL update the `event_members` record's status and notify the Participant via the notification system.
4. WHEN an Organiser rejects an application, THE Platform SHALL update the status to `Rejected`, notify the Participant with an optional reason, and prevent re-application.
5. WHEN a Participant withdraws their application before Organiser review, THE Platform SHALL soft-delete the `event_members` record and allow re-application.
6. IF the Event's `registration_deadline` has passed, THEN THE Platform SHALL reject new applications with HTTP 422 citing the expired deadline.
7. THE Platform SHALL track application state: `Pending`, `Approved`, `Rejected`, `Withdrawn` — and display the current state to both the Participant and the Organiser.
8. WHEN any application state changes, THE Platform SHALL emit a domain event and write an audit log entry.

### Requirement 5: Team Formation and Management

**User Story:** As a participant, I want to create a team, invite members, manage my roster, and transfer captainship, so that my team is ready to compete.

#### Acceptance Criteria

1. WHEN an approved Participant creates a Team during `RegistrationOpen` or `RegistrationClosed` state, THE Platform SHALL create a `teams` record with `captain_id = creator`, add the creator to `team_members`, and update their `event_members.team_status` to `in_team`.
2. THE Platform SHALL enforce one-team-per-participant — WHEN a user who is already a `team_members` record holder for the same Event tries to create or join another team, THE Platform SHALL return HTTP 409.
3. THE Platform SHALL enforce `team_size_max` — WHEN a join request or accepted invitation would exceed the maximum, THE Platform SHALL return HTTP 422.
4. THE Platform SHALL enforce `team_size_min` before locking — WHEN the Organiser attempts to lock team formation, THE Platform SHALL validate that every active team meets the minimum and return HTTP 422 listing non-compliant teams.
5. WHEN a Team Captain invites a Participant by email or user ID, THE Platform SHALL create an `invitations` record with `type = team`, send an email notification, and set expiry to 48 hours.
6. WHEN an invitee accepts a team invitation, THE Platform SHALL add them to `team_members`, update their `event_members.team_status`, and notify the Team Captain.
7. WHEN an invitee declines a team invitation, THE Platform SHALL update the `invitations` record to `Declined` and notify the Team Captain.
8. WHEN a Team Captain removes a member before team lock, THE Platform SHALL delete the `team_members` record and update the member's `event_members.team_status` to `unassigned`.
9. WHEN a Team Captain leaves their own team and other members remain, THE Platform SHALL automatically assign captainship to the earliest-joined remaining member.
10. WHEN a Team Captain leaves and no other members remain, THE Platform SHALL delete the empty team record.
11. WHEN the Organiser transitions the Event to `TeamFormationLocked`, THE Platform SHALL set all teams' `locked = true` and prevent any further membership changes.
12. THE Platform SHALL support solo participants — WHEN `team_size_min = 1`, a single-member team SHALL be valid; solo participants SHALL be auto-converted to Team Captains of single-member teams before lock if not already.
13. THE Platform SHALL provide full CRUD for Teams: Create, Read (roster + captain), Update (name by Captain only), Soft Delete (by Captain when team has zero submissions and event is pre-lock).

### Requirement 6: Submission Lifecycle

**User Story:** As a Team Captain, I want to submit our project, update it before the deadline, and track its judging status, so that our work is evaluated correctly.

#### Acceptance Criteria

1. WHEN the Event enters `SubmissionOpen` state, THE Platform SHALL allow Team Captains to create a Submission with a `title`, `description`, `repository_url`, and optional `demo_url`.
2. THE Platform SHALL enforce `resubmission_policy` — WHEN resubmissions are disabled and a Submission is in `Submitted` status, THE Platform SHALL reject any update with HTTP 422.
3. WHEN a Team Captain saves a Submission without finalising, THE Platform SHALL store it with `status = Draft` and allow further edits.
4. WHEN a Team Captain finalises a Submission, THE Platform SHALL transition `status` to `Submitted` and record the `submitted_at` timestamp.
5. IF the Event state is `SubmissionClosed`, THEN THE Platform SHALL reject new Submission creation or update to an existing Draft with HTTP 422.
6. WHEN the Event transitions to `SubmissionClosed`, THE Platform SHALL flag all remaining `Draft` Submissions as `Incomplete` without auto-submitting them.
7. THE Platform SHALL prevent a Team from creating more than one Submission per Event — duplicate attempts SHALL return HTTP 409.
8. THE Platform SHALL provide full CRUD: Create, Read (by team, by event), Update (while `Draft` or resubmission-allowed), Soft Delete (by Organiser only).
9. FOR ALL valid Submission state transitions, THE Platform SHALL emit a domain event and record an audit log entry.
10. WHEN a Submission is created or updated, THE Platform SHALL validate file attachments against the Event's `file_policy` (allowed MIME types and max size); invalid files SHALL return HTTP 422.

### Requirement 7: Judge Assignment and Evaluation Lifecycle

**User Story:** As a Judge, I want to receive my assignment, view submissions, score them against a rubric, and submit my final evaluation, so that winners are determined fairly.

#### Acceptance Criteria

1. WHEN an Organiser assigns a Judge by adding an `event_members` record with `role = Judge`, THE Platform SHALL notify the Judge and make all Submissions visible to them once the Event enters `JudgingRound1`.
2. WHEN the Event enters `JudgingRound1`, THE Platform SHALL enable the Judge's scoring workspace for all assigned Submissions.
3. WHEN a Judge saves scores without submitting, THE Platform SHALL transition the Evaluation to `Draft` status via the EvaluationStateMachine and persist scores without affecting rankings.
4. WHEN a Judge submits a final Evaluation, THE Platform SHALL transition it to `Submitted` status, compute and persist the `total_score`, and prevent further edits unless the Organiser explicitly unlocks re-scoring.
5. THE Platform SHALL auto-save draft scores — WHEN a Judge edits any score field, THE Platform SHALL debounce and persist the change within 2 seconds without requiring an explicit save action.
6. IF a Judge declares a conflict of interest for a Submission, THEN THE Platform SHALL transition the Evaluation to `Flagged` status and notify the Organiser for reassignment.
7. THE Platform SHALL enforce rubric weight validation — WHEN scores are submitted, THE Platform SHALL verify all individual scores are within `[0, criterion.max_score]` and return HTTP 422 on violation.
8. THE Platform SHALL prevent duplicate Evaluations — a single Judge SHALL NOT submit more than one `Submitted` Evaluation per Submission per round; duplicates return HTTP 409.
9. WHEN the Organiser finalises judging, THE Platform SHALL transition all `Submitted` Evaluations to `Finalized`, making scores immutable.
10. WHEN all Evaluations for all Submissions are in `Submitted` status, THE Platform SHALL allow the Organiser to advance the Event state.
11. FOR ALL Evaluation state transitions, THE Platform SHALL emit a domain event and record an audit log entry with `judge_id`, `submission_id`, and new state.

### Requirement 8: Rankings, Prize Allocation, and Dispute Window

**User Story:** As an Organiser, I want the platform to generate rankings from judge scores, allocate prize amounts, manage any disputes, and verify results before releasing funds.

#### Acceptance Criteria

1. WHEN the Event transitions to `WinnerVerification`, THE Platform SHALL generate a ranked list of Teams ordered by weighted aggregate score, breaking ties by `submitted_at` (earlier submission ranks higher).
2. THE Platform SHALL apply the Event's `judging_strategy` when computing weighted aggregate scores and SHALL store the result in `event_rankings_snapshot`.
3. WHEN the Organiser confirms winners, THE Platform SHALL create a `prize_allocation_batches` record with `status = Locked` and individual `prize_allocations` records per ranked winner.
4. THE Platform SHALL prevent any modification to confirmed rankings or prize allocations after the batch status is `Locked`.
5. WHEN the Event transitions to `DisputeWindow`, THE Platform SHALL record the window-open timestamp and display the elapsed/remaining time based on `review_window_hours`.
6. IF a Participant files a dispute during `DisputeWindow`, THEN THE Platform SHALL create a `disputes` record with `state = Open` and block the `PrizeApproved` transition until the dispute is resolved.
7. WHEN all disputes are resolved and `review_window_hours` has elapsed, THE Platform SHALL allow the Organiser to advance to `PrizeApproved`.
8. FOR ALL prize allocation computations, THE Platform SHALL verify that the sum of all individual payout amounts equals `prize_pool_target` within a tolerance of 1 stroop (0.0000001 XLM) and return HTTP 422 if not.

### Requirement 9: Soroban Escrow and Prize Disbursement

**User Story:** As an Organiser, I want to fund the prize escrow on-chain and release funds to winners trustlessly, so that prize delivery is transparent and guaranteed.

#### Acceptance Criteria

1. WHEN an Organiser creates an escrow for an Event, THE Platform SHALL create an `escrow_accounts` record linked to the Event and deploy the Soroban smart contract on the configured Stellar network (`mainnet` or `testnet`).
2. WHEN funds are deposited on-chain, THE Platform SHALL verify the transaction via the Stellar Horizon API, update `escrow_accounts.available_balance`, and record a `funding_transactions` entry.
3. WHEN the escrow balance matches `prize_pool_target` within 1 stroop tolerance, THE Platform SHALL mark `escrow_accounts.status = Funded` and enable the `PrizeApproved → EscrowRelease` transition.
4. WHEN the Organiser initiates prize release, THE Platform SHALL call the Soroban `disburse` function for each `prize_allocations` record in the approved batch and record each transaction hash.
5. THE Platform SHALL monitor disbursement status via the `escrow-state-map` — WHEN a disbursement transaction is confirmed on-chain, THE Platform SHALL update the `prize_allocations` record's `status` to `Paid` and notify the recipient.
6. WHEN all `prize_allocations` in a batch reach `Paid` status, THE Platform SHALL transition the Event to `Completed`.
7. WHEN an Event is cancelled with an active funded escrow, THE Platform SHALL call the Soroban `refund` function and return all funds to the depositor's wallet, recording the refund transaction hash.
8. THE Platform SHALL use the `EscrowStateMachine` to validate all escrow state transitions — invalid transitions SHALL return HTTP 422 with `unmetPreconditions`.
9. THE Platform SHALL expose an `/api/escrow/[id]/on-chain-state` endpoint that fetches live state from the Soroban contract and reconciles it with the database record.
10. THE Platform SHALL support idempotent escrow operations — WHEN a write operation includes an `Idempotency-Key` header, THE Platform SHALL return the cached response for duplicate requests without re-executing the operation.

### Requirement 10: Organiser Event Lifecycle Management

**User Story:** As an Organiser, I want to create, publish, manage, and archive events through all lifecycle states, so that I can run professional hackathons end-to-end.

#### Acceptance Criteria

1. WHEN an Organiser creates an Event, THE Platform SHALL require `title`, `description`, `category`, `format`, `team_size_min`, `team_size_max`, `network_mode`, and `workspace_id`; all other fields SHALL be optional at creation.
2. THE Platform SHALL enforce the `EventWorkflowEngine` transition preconditions — WHEN an Organiser attempts an invalid state transition, THE Platform SHALL return HTTP 422 with an array of `unmetPreconditions`.
3. WHEN an Event is in `Draft` state, THE Platform SHALL allow the Organiser to edit all event fields.
4. WHEN an Event has entered `RegistrationOpen` state, THE Platform SHALL prevent editing of `prize_pool_target`, `team_size_min`, `team_size_max`, and `registration_deadline`.
5. THE Platform SHALL provide full CRUD: Create, Read (detail + paginated workspace list + public discover list), Update (field-level restrictions by state), Soft Delete (by Organiser when in `Draft` only), Archive (from `Completed` or `Cancelled` only).
6. WHEN an Organiser cancels an Event with a funded escrow, THE Platform SHALL trigger the Soroban `refund` function before marking the Event as `Cancelled`.
7. THE Platform SHALL support event templates — WHEN an Organiser selects an existing Event as a template, THE Platform SHALL pre-populate the creation form with its non-UUID fields via the `use-event-templates` hook.
8. THE Platform SHALL display a pre-publish checklist in the Draft state — showing which preconditions (judge assigned, registration deadline set, prize pool target > 0) are met and which are outstanding.
9. THE Platform SHALL version events — WHEN any event field is updated, THE Platform SHALL insert a snapshot record into `event_versions` with the actor ID and incremented version number.

### Requirement 11: Complete CRUD Validation for All Domain Entities

**User Story:** As a platform engineer, I want every domain entity to have complete, validated CRUD operations with proper permissions, so that no workflow is left in an inconsistent state.

#### Acceptance Criteria

1. FOR EACH entity (Events, Teams, Participants, Applications, Invitations, Submissions, Judges, Scores, Rankings, Prizes, Escrow, Wallets, Notifications), THE Platform SHALL implement Create, Read, Update, and Delete endpoints with server-side input validation via Zod schemas.
2. THE Platform SHALL support soft delete for Events, Teams, Submissions, and Invitations — hard delete SHALL be reserved for PlatformAdmin bulk-purge operations only.
3. THE Platform SHALL support restore for soft-deleted records within the Event's `retention_days` window.
4. ALL list endpoints SHALL support pagination (cursor-based or offset), filtering by relevant fields, full-text search where applicable, and sorting by at least `created_at` and a domain-relevant field.
5. WHEN any write operation fails validation, THE Platform SHALL return HTTP 422 with a structured error body: `{ code, message, field, details }`.
6. THE Platform SHALL enforce ownership validation on all mutating operations — WHEN a user attempts to update or delete a resource they do not own, THE Platform SHALL return HTTP 403.
7. ALL write operations on financial entities (Escrow, Prizes, Wallets) SHALL be covered by audit log entries in `audit_records`.
8. THE Platform SHALL prevent phantom reads during concurrent team-size enforcement by using optimistic locking (version increment) on the `teams` table.

### Requirement 12: RBAC and Security Enforcement

**User Story:** As a platform administrator, I want every API route to enforce role-based access control and input sanitisation, so that no user can access or mutate data outside their permissions.

#### Acceptance Criteria

1. THE Platform SHALL enforce server-side RBAC on every API route using the `requirePermission` / `requireEventRole` / `requireWorkspaceRole` helpers in `lib/auth/permissions.ts`.
2. THE Platform SHALL apply Supabase RLS policies as a second layer — WHEN the service client bypasses RLS for admin operations, THE Platform SHALL explicitly document the bypass reason in code comments.
3. THE Platform SHALL validate all request bodies with Zod schemas before any database write — unvalidated raw body access SHALL be flagged as a security defect.
4. THE Platform SHALL apply rate limiting via `lib/rate-limit.ts` on all public and authentication endpoints — exceeding the limit SHALL return HTTP 429 with a `Retry-After` header.
5. THE Platform SHALL prevent IDOR (Insecure Direct Object Reference) — WHEN a route accesses a resource by ID, THE Platform SHALL verify the requesting user's relationship to that resource before returning or mutating it.
6. THE Platform SHALL not expose internal error details to clients — WHEN an unhandled error occurs, THE Platform SHALL return a generic error envelope and log the full error server-side.
7. THE Platform SHALL validate wallet signatures using the Stellar SDK challenge mechanism before linking any wallet address to a user account.
8. THE Platform SHALL enforce idempotency on all financial write operations — WHEN a request includes `Idempotency-Key`, THE Platform SHALL use the `idempotency_keys` table to deduplicate requests.

### Requirement 13: User Experience and Interface Quality

**User Story:** As any user, I want every page to handle all UI states correctly — loading, empty, error, and success — so that the interface is always clear and actionable.

#### Acceptance Criteria

1. EVERY page that fetches async data SHALL display a skeleton or spinner loading state while data is in flight.
2. EVERY list view that can return zero results SHALL display a contextually relevant empty state with a primary call-to-action (e.g., "Create your first event", "No submissions yet — the window opens on [date]").
3. EVERY form SHALL display field-level validation errors inline, below the relevant input, in real time on blur.
4. WHEN a server action fails, THE Platform SHALL display a toast notification with the error message and a retry option where applicable.
5. WHEN a destructive action is performed (delete, cancel, leave team), THE Platform SHALL present a confirmation dialog before executing.
6. ALL event status changes SHALL be reflected immediately in status badges on the relevant page without requiring a full page reload.
7. THE Platform SHALL display breadcrumb navigation on all nested pages (event detail sub-pages, team pages, judge workspace).
8. THE Platform SHALL be mobile-responsive — all pages SHALL be fully functional and visually correct at viewport widths from 375px to 1920px.
9. THE Platform SHALL meet WCAG 2.1 AA colour contrast standards on all interactive elements and text.
10. WHEN a user navigates to a route for which they lack permission, THE Platform SHALL display a contextual access-denied page rather than a blank or error page.
11. Progress indicators SHALL be shown for multi-step flows (event creation wizard, escrow funding, judging submission).

### Requirement 14: Admin Platform Management

**User Story:** As a Platform Admin, I want tools to manage users, monitor event health, oversee escrow, and review audit logs, so that I can operate the platform safely.

#### Acceptance Criteria

1. WHEN a PlatformAdmin accesses `/admin`, THE Platform SHALL display a dashboard with active event count, total escrow value locked, pending disputes, and system health status.
2. THE Platform SHALL provide a user management interface — PlatformAdmin SHALL be able to view all users, suspend accounts, and force-reset passwords.
3. THE Platform SHALL expose full audit log search at `/admin/audit` — PlatformAdmin SHALL be able to filter by `actor_id`, `target_type`, `action`, date range, and `workspace_id`.
4. THE Platform SHALL allow PlatformAdmin to override Event state transitions in exceptional circumstances, with a mandatory reason logged in `audit_logs`.
5. THE Platform SHALL provide feature-flag management via `lib/services/feature-flags.ts` — PlatformAdmin SHALL be able to enable/disable flags without a deployment.
6. THE Platform SHALL expose a system health endpoint at `/api/health` returning database connectivity, Stellar network reachability, and current queue depth.
7. THE Platform SHALL allow PlatformAdmin to monitor all active escrow accounts, their on-chain balance, and disbursement status.
8. THE Platform SHALL enforce that only users with `PlatformAdmin` role in `workspace_members` or a dedicated admin flag can access any `/admin` route.

### Requirement 15: Notifications and Communication

**User Story:** As any user, I want to receive timely in-app and email notifications for all relevant events in my workflows, so that I never miss a critical action.

#### Acceptance Criteria

1. THE Platform SHALL send notifications for the following trigger events: application received, application approved/rejected, team invitation sent/accepted/declined, member removed, submission received, judging started, evaluation submitted, winner announced, dispute filed, dispute resolved, escrow funded, prize disbursed.
2. WHEN a notification is created, THE Platform SHALL persist it to the `notifications` table and mark it as `unread`.
3. THE Platform SHALL display a notification badge count in the main navigation showing the number of unread notifications.
4. WHEN a user visits `/notifications`, THE Platform SHALL display all notifications with timestamp, type icon, and a link to the relevant resource.
5. WHEN a user reads a notification, THE Platform SHALL mark it as `read` and decrement the badge count.
6. THE Platform SHALL send email notifications for high-priority events (application result, winner announcement, dispute filed) via the `email` service using the Resend provider.
7. THE Platform SHALL respect user notification preferences — WHEN a user opts out of email notifications for a category, THE Platform SHALL skip email delivery for that category while still persisting in-app notifications.

### Requirement 16: Production Readiness and Operational Quality

**User Story:** As a platform engineer, I want the system to be production-deployable with proper error handling, observability, and automated validation, so that the platform can handle real events reliably.

#### Acceptance Criteria

1. THE Platform SHALL validate all required environment variables at startup using `lib/env-validation.ts` — missing variables SHALL cause the server to fail fast with a descriptive error.
2. ALL API error responses SHALL follow the structured error envelope defined in `lib/errors/responses.ts` — raw stack traces SHALL never be exposed in production.
3. THE Platform SHALL use the `lib/logger.ts` module for all server-side logging — log entries SHALL include `level`, `timestamp`, `requestId`, `userId` where available, and `message`.
4. THE Platform SHALL implement scheduled jobs via `/api/cron` — the `process-events` cron SHALL auto-transition Events whose deadlines have elapsed (e.g., `registration_deadline` triggers `RegistrationOpen → RegistrationClosed`), and the `reconcile` cron SHALL sync on-chain escrow state with the database.
5. THE Platform SHALL maintain a property-based test suite using `fast-check` covering the Event state machine, Escrow state machine, Dispute state machine, and team-size invariants — all properties SHALL pass in CI.
6. THE Platform SHALL pass ESLint with zero errors on the `eslint.config.mjs` ruleset before any deployment.
7. THE Platform SHALL implement a `/api/health/ready` endpoint that returns HTTP 200 only when the database connection pool is healthy and at least one Stellar network node is reachable.
8. ALL database migrations SHALL be idempotent and versioned via the Supabase migrations directory — no migration SHALL drop data without an explicit admin confirmation step.
9. THE Platform SHALL implement optimistic concurrency on all versioned entities (Events, Teams, Evaluations, Escrow) using the `version` column — concurrent write conflicts SHALL return HTTP 409 with a `conflictVersion` field.
10. THE Platform SHALL enforce a maximum API response time of 2000ms for all list endpoints and 500ms for all single-resource endpoints under normal load — exceeding these thresholds SHALL be logged as performance warnings.

