# Requirements Document

## Introduction

This document specifies the requirements for converting the Stellar Guardian hackathon prize escrow platform from a React 19 + Vite SPA with an Express 4 backend (monolithic server.ts, better-sqlite3, Firebase/Firestore sync) into a production-grade Next.js full-stack application backed by PostgreSQL (via Supabase). The conversion addresses 19 critical/high-severity issues identified in the production readiness audit — including broken escrow funding, wallet verification gaps, security vulnerabilities, missing business workflows, and architectural debt — while establishing a scalable, secure, and maintainable foundation for hackathon prize money management on the Stellar blockchain.

## Glossary

- **Platform**: The Stellar Guardian Next.js application as a whole
- **Organizer**: A user who creates and manages hackathon events (previously called "host")
- **Participant**: A user who registers for and competes in hackathon events
- **Judge**: A user assigned to evaluate submissions for a hackathon event
- **Escrow_Account**: A Stellar blockchain account that holds prize funds in custody until disbursement conditions are met
- **Wallet_Verifier**: The subsystem responsible for proving cryptographic ownership of a Stellar wallet address
- **State_Machine**: The subsystem governing valid event lifecycle transitions (Draft → Funded → Published → Registration Open → Registration Closed → In Progress → Judging → Dispute Window → Completed → Archived/Cancelled)
- **Dispute_Window**: A configurable time period after winners are announced during which participants can raise objections before prize disbursement is finalized
- **Idempotency_Key**: A client-generated unique identifier submitted with financial requests to ensure exactly-once processing
- **Supabase**: The PostgreSQL-based backend-as-a-service providing database, authentication, row-level security, and real-time subscriptions
- **RLS**: Row Level Security — PostgreSQL policies that restrict data access at the database layer
- **Next_App_Router**: The Next.js App Router architecture using server components, route handlers, and server actions
- **Stellar_SDK**: The official Stellar JavaScript SDK (@stellar/stellar-sdk) for blockchain operations
- **Challenge_Response**: A cryptographic protocol where the server issues a random nonce and the client signs it with the private key corresponding to the claimed public address
- **Workspace**: An organizational unit that owns events, manages members, and holds billing configuration — analogous to an organization or team account
- **Workspace_Owner**: The user who created a workspace and holds ultimate administrative authority over its configuration, members, and events
- **Activity_Timeline**: A chronological, append-only record of all significant actions performed within an event or workspace, visible to authorized users for transparency
- **Audit_Record**: An immutable log entry capturing actor, timestamp, action, before/after state, and contextual metadata for compliance and forensic analysis
- **Wallet_Adapter**: A plugin interface that abstracts wallet provider specifics (Freighter, Albedo, xBull, etc.) behind a unified connection and signing API
- **Escrow_Lifecycle**: The complete state progression of escrow funds from initial creation through funding, locking, release or refund, with defined transitions and guard conditions
- **Permission_Matrix**: A structured mapping of roles to allowed operations across all platform resources, enforced at both API and database layers
- **Plugin**: An extensibility module that adds functionality to the platform without modifying core code, loaded through defined extension points
- **Webhook**: An HTTP callback triggered by platform events, delivering structured payloads to registered external endpoints for third-party integration
- **Dashboard**: A role-specific view aggregating KPIs, quick actions, and status summaries relevant to a user's responsibilities within the platform
- **Submission_Version**: A tracked revision of a project submission, preserving history and enabling comparison between iterations
- **Network_Mode**: The Stellar network configuration (testnet or mainnet) determining which blockchain environment the platform interacts with for transactions

## Requirements

### Requirement 1: Next.js Application Architecture

**User Story:** As a developer, I want the platform rebuilt as a Next.js App Router application with server components, so that the codebase has a unified full-stack architecture with SSR, API routes, and optimized client bundles.

#### Acceptance Criteria

1. THE Platform SHALL use Next.js App Router with the `/app` directory structure for all routing and page rendering
2. THE Platform SHALL render data-fetching pages as React Server Components by default, using client components only for interactive UI elements
3. THE Platform SHALL use Next.js Route Handlers (`/app/api/`) for all backend API endpoints, replacing the Express server entirely
4. THE Platform SHALL use Next.js middleware for authentication verification, rate limiting, and request-level security headers on all protected routes
5. THE Platform SHALL implement a shared type system where database schemas, API request/response types, and component props derive from a single source of truth using Zod schemas
6. THE Platform SHALL separate concerns into the following directory structure: `/app` (routes/pages), `/lib` (shared utilities, database client, services), `/components` (reusable UI), `/types` (shared type definitions)
7. WHEN the application is deployed, THE Platform SHALL produce a single deployable artifact with no dependency on a separate backend server process

### Requirement 2: PostgreSQL Database via Supabase

**User Story:** As a developer, I want the platform backed by PostgreSQL through Supabase, so that the database supports concurrent access, row-level security, real-time subscriptions, and proper relational integrity without the limitations of SQLite or Firestore sync hacks.

#### Acceptance Criteria

1. THE Platform SHALL use Supabase PostgreSQL as the sole persistent data store, replacing both better-sqlite3 and Firebase/Firestore
2. THE Platform SHALL define all database tables with proper foreign key constraints, indexes on frequently queried columns, and CHECK constraints for enumerated values
3. THE Platform SHALL implement Row Level Security policies on all tables such that users can only read and modify data they are authorized to access
4. THE Platform SHALL use database migrations managed through Supabase CLI for all schema changes with up/down migration support
5. THE Platform SHALL use Supabase client libraries for real-time subscriptions on event state changes, notifications, and team updates — replacing the naive Firestore sync
6. IF the Supabase connection is unavailable, THEN THE Platform SHALL return a 503 Service Unavailable response with a structured error indicating temporary downtime
7. THE Platform SHALL store all timestamps in UTC using the `timestamptz` PostgreSQL type

### Requirement 3: Authentication and Authorization

**User Story:** As a user, I want secure authentication with proper session management, so that my account is protected and my access permissions are correctly enforced.

#### Acceptance Criteria

1. THE Platform SHALL use Supabase Auth for user authentication, supporting email/password registration and login
2. THE Platform SHALL issue and validate JWT access tokens through Supabase Auth with automatic token refresh handled client-side
3. THE Platform SHALL enforce role-based access control with three roles: Organizer, Participant, and Judge — where a user can hold different roles across different events
4. THE Platform SHALL implement authorization checks as reusable middleware functions composed in a fixed order: authenticate → authorize → validate → handle
5. THE Platform SHALL reject requests to protected endpoints with a 401 Unauthorized response containing a structured error envelope when no valid token is provided
6. IF a user attempts an action outside their role scope for a specific event, THEN THE Platform SHALL return a 403 Forbidden response with a descriptive error code
7. THE Platform SHALL implement a single authorization helper for Organizer-only operations, eliminating the 15+ copy-pasted inline checks present in the current codebase

### Requirement 4: Organizer-Funded Escrow Model

**User Story:** As an organizer, I want to fund my hackathon's prize escrow from my own Stellar wallet, so that participants can cryptographically verify that real prize money is held in custody.

#### Acceptance Criteria

1. WHEN an organizer initiates escrow funding, THE Escrow_Account SHALL require a signed Stellar transaction from the organizer's verified wallet — the Platform private key SHALL NOT be used as the funding source
2. THE Platform SHALL generate a unique Stellar escrow keypair per event and store only the public key in the database — the secret key SHALL be encrypted at rest using a KMS-backed envelope encryption scheme
3. WHEN a funding transaction is submitted, THE Platform SHALL verify the transaction on the Stellar network (testnet or mainnet based on configuration) before marking the event as Funded
4. THE Platform SHALL record the on-chain transaction hash as the canonical funding reference, not a locally generated random hex string
5. IF the funding transaction fails or is not found on-chain within 5 minutes of submission, THEN THE Platform SHALL keep the event in Draft state and notify the organizer with a descriptive error
6. THE Platform SHALL expose a public verification endpoint that returns the escrow account's on-chain balance and transaction history for any funded event, enabling independent trust verification
7. THE Platform SHALL support only @stellar/stellar-sdk (version 16+) for all blockchain operations, removing the duplicate stellar-sdk v13 dependency

### Requirement 5: Wallet Ownership Verification

**User Story:** As a user, I want my wallet connection to require cryptographic proof of ownership, so that no one can claim my wallet address and redirect my prize winnings.

#### Acceptance Criteria

1. WHEN a user initiates wallet connection, THE Wallet_Verifier SHALL generate a random 32-byte nonce (challenge) and store it server-side with a 5-minute expiration
2. THE Wallet_Verifier SHALL require the user to sign the challenge nonce using the private key corresponding to the claimed Stellar public address
3. WHEN a signed challenge is submitted, THE Wallet_Verifier SHALL verify the signature against the claimed public key using the Stellar SDK's Keypair.verify method
4. IF signature verification fails, THEN THE Wallet_Verifier SHALL reject the wallet connection with a 400 response and descriptive error
5. IF the challenge nonce has expired (older than 5 minutes), THEN THE Wallet_Verifier SHALL reject the request and require a fresh challenge
6. THE Platform SHALL store wallet addresses only after successful challenge-response verification and mark the association as cryptographically verified in the database
7. THE Platform SHALL prevent wallet address changes without completing a new challenge-response flow for the new address

### Requirement 6: Event State Machine

**User Story:** As an organizer, I want a single, enforced event lifecycle with clear transitions, so that events progress through well-defined stages and invalid state changes are impossible.

#### Acceptance Criteria

1. THE State_Machine SHALL define exactly one canonical set of states and transitions shared between server and client: Draft → Funded → Published → Registration Open → Registration Closed → In Progress → Judging → Dispute Window → Completed → Archived, with Cancelled reachable from any non-terminal state
2. THE State_Machine SHALL be implemented as a single TypeScript module importable by both server-side route handlers and client-side UI components
3. WHEN a state transition is requested, THE State_Machine SHALL validate the transition against the canonical transition map before any database modification
4. IF an invalid state transition is requested, THEN THE Platform SHALL return a 422 response with the current state, requested state, and list of valid transitions from the current state
5. THE State_Machine SHALL enforce preconditions for specific transitions: Funded requires on-chain escrow verification, Published requires at least one judge assigned, Completed requires the Dispute_Window to have elapsed without unresolved disputes
6. THE Platform SHALL eliminate the duplicate state machine implementations (server.ts VALID_TRANSITIONS and src/lib/eventStatus.ts) in favor of the single shared module

### Requirement 7: Dispute and Objection Window

**User Story:** As a participant, I want a dispute window after winners are announced, so that I can raise objections before irreversible prize disbursement occurs.

#### Acceptance Criteria

1. WHEN winners are set by the organizer, THE State_Machine SHALL transition the event to Dispute Window state instead of directly to Completed
2. THE Platform SHALL support a configurable dispute window duration per event (default: 72 hours, minimum: 24 hours, maximum: 168 hours)
3. WHILE the event is in Dispute Window state, THE Platform SHALL accept dispute submissions from any accepted participant of that event
4. WHEN a dispute is submitted, THE Platform SHALL notify the organizer and all judges via in-app notification and email
5. IF the dispute window elapses with zero unresolved disputes, THEN THE State_Machine SHALL automatically transition the event to Completed state
6. IF unresolved disputes exist when the window elapses, THEN THE Platform SHALL keep the event in Dispute Window state and notify the organizer that manual resolution is required
7. THE Platform SHALL prevent prize disbursement while any dispute remains unresolved

### Requirement 8: Prize Allocation Validation and Disbursement

**User Story:** As an organizer, I want prize allocation validated against the actual escrow balance before disbursement, so that overallocation is caught early and all winners receive their correct prizes.

#### Acceptance Criteria

1. WHEN winners and prize amounts are submitted, THE Platform SHALL validate that the sum of all prize amounts does not exceed the confirmed on-chain escrow balance
2. IF the total allocated prizes exceed the escrow balance, THEN THE Platform SHALL reject the winner submission with a 422 response showing the escrow balance and the attempted total allocation
3. WHEN disbursement is triggered after a successful dispute window, THE Platform SHALL execute individual Stellar payments from the escrow account to each winner's verified wallet address
4. THE Platform SHALL record each disbursement transaction hash and associate it with the corresponding winner record
5. IF a winner does not have a verified wallet address at disbursement time, THEN THE Platform SHALL skip that winner, hold their allocation in escrow, and notify the organizer
6. THE Platform SHALL implement atomic disbursement: either all eligible winner payments succeed within a single Stellar transaction batch, or none are committed
7. WHEN all prizes are disbursed and the dispute window has passed, THE Platform SHALL mark the event as Completed with a verifiable on-chain proof of disbursement

### Requirement 9: Refund Path for Cancelled Events

**User Story:** As an organizer, I want funded events that are cancelled to automatically return escrow funds to my wallet, so that my money is never stranded in an orphaned escrow account.

#### Acceptance Criteria

1. WHEN a funded event is cancelled, THE Platform SHALL initiate an automatic refund of the entire escrow balance to the organizer's verified wallet address
2. THE Platform SHALL verify the refund transaction on-chain before marking the cancellation as complete
3. THE Platform SHALL record the refund transaction hash in the transactions table with type 'refund'
4. IF the automated refund fails (network error, insufficient fees), THEN THE Platform SHALL mark the event as 'Cancellation Pending' and retry up to 3 times with exponential backoff
5. IF all refund retries fail, THEN THE Platform SHALL alert the organizer and platform administrators with the escrow account public key for manual recovery
6. THE Platform SHALL prevent event deletion while a refund is pending or unconfirmed

### Requirement 10: Team Formation and Management

**User Story:** As a participant, I want to create teams, invite teammates, and join existing teams, so that collaborative hackathon participation is fully supported.

#### Acceptance Criteria

1. WHEN a participant creates a team, THE Platform SHALL designate them as team leader and add them as the first member
2. THE Platform SHALL enforce the event's teamSizeMax configuration — rejecting team join requests that would exceed the maximum
3. THE Platform SHALL provide a team invitation flow where team leaders can invite other accepted participants by email or username
4. WHEN a participant accepts a team invitation, THE Platform SHALL add them to the team if the team has not reached capacity
5. THE Platform SHALL allow participants to leave a team, with the team leader role transferring to the next-earliest member if the leader leaves
6. WHEN a team submits a project, THE Platform SHALL associate the submission with the team and grant edit access to all team members
7. THE Platform SHALL prevent a participant from being a member of more than one team per event

### Requirement 11: Judge Conflict of Interest

**User Story:** As a platform operator, I want judges prevented from scoring submissions by teammates or close associates, so that evaluation integrity is maintained.

#### Acceptance Criteria

1. WHEN a judge attempts to score a submission, THE Platform SHALL check whether the judge is a member of the submitting team (not only the individual submitter)
2. IF the judge is a member of the submission's team, THEN THE Platform SHALL reject the scoring with a CONFLICT_OF_INTEREST error
3. THE Platform SHALL prevent a user from holding both Judge and Participant roles on the same event
4. WHEN calculating average scores for a submission, THE Platform SHALL exclude any evaluations flagged as conflicts of interest
5. THE Platform SHALL log all conflict-of-interest rejections for audit purposes

### Requirement 12: API Pagination and God Endpoint Elimination

**User Story:** As a developer, I want all list endpoints paginated and the monolithic event detail endpoint split into focused sub-resources, so that the API scales efficiently and clients fetch only what they need.

#### Acceptance Criteria

1. THE Platform SHALL implement cursor-based pagination on all list endpoints (events, public events, members, submissions, evaluations, teams, notifications) with a default page size of 20 and maximum of 50
2. THE Platform SHALL return pagination metadata in a consistent envelope: `{ data: [...], meta: { cursor, hasMore, total } }`
3. THE Platform SHALL split the current god endpoint (GET /api/events/:id) into focused sub-resource endpoints: `/events/:id` (core), `/events/:id/members`, `/events/:id/submissions`, `/events/:id/evaluations`, `/events/:id/teams`, `/events/:id/transactions`, `/events/:id/winners`, `/events/:id/sponsors`, `/events/:id/milestones`
4. WHEN a client requests an event detail, THE Platform SHALL return only core event data, host info, user's membership/role, and trust checklist — sub-resources require separate requests
5. THE Platform SHALL support filtering and sorting query parameters on list endpoints using validated Zod schemas

### Requirement 13: Idempotency for Financial Operations

**User Story:** As an organizer, I want financial operations (fund, payout, refund) to be idempotent, so that network retries or duplicate clicks never result in double-spending.

#### Acceptance Criteria

1. THE Platform SHALL require an Idempotency_Key header on all financial endpoints (fund, payout, refund, disbursement)
2. WHEN a request with a previously-seen Idempotency_Key is received, THE Platform SHALL return the stored response from the original request without re-executing the operation
3. THE Platform SHALL store idempotency records with the key, response payload, and a 24-hour TTL
4. IF a request with a duplicate Idempotency_Key but different request body is received, THEN THE Platform SHALL return a 409 Conflict error
5. THE Platform SHALL use database-level unique constraints on idempotency keys to prevent race conditions in concurrent duplicate requests

### Requirement 14: Security Hardening

**User Story:** As a platform operator, I want comprehensive security controls, so that the platform protects user funds, data, and privacy against common attack vectors.

#### Acceptance Criteria

1. THE Platform SHALL implement Content Security Policy headers that disallow 'unsafe-inline' for scripts in production, using nonces for any required inline scripts
2. THE Platform SHALL enforce rate limiting on authentication endpoints (10 requests per 15 minutes) and general API endpoints (200 requests per 15 minutes per IP)
3. THE Platform SHALL validate and sanitize all user inputs using Zod schemas before processing — no endpoint shall accept unvalidated input
4. THE Platform SHALL store all secrets (Stellar keys, JWT secrets, API keys) in environment variables and never commit them to version control or expose them in client bundles
5. THE Platform SHALL implement CORS restrictions allowing only explicitly configured origins in production
6. THE Platform SHALL use parameterized queries exclusively for all database operations — no string interpolation in SQL
7. THE Platform SHALL remove all dead/incomplete security-sensitive integrations (Firebase Firestore rules with world-writable collections, half-wired Gmail OAuth) from the codebase
8. THE Platform SHALL implement CSRF protection on all state-mutating endpoints using the Synchronizer Token pattern or SameSite cookie attributes
9. THE Platform SHALL enforce HTTPS-only in production with Strict-Transport-Security headers

### Requirement 15: Submission Drafts and Workflow

**User Story:** As a participant, I want to save submission drafts before final submission, so that I can work on my entry incrementally without losing progress.

#### Acceptance Criteria

1. THE Platform SHALL support submission states: Draft and Submitted
2. WHEN a participant saves a submission with draft status, THE Platform SHALL persist the submission without making it visible to judges or the organizer
3. WHILE a submission is in Draft state, THE Platform SHALL allow unlimited edits by the submitter or their team members
4. WHEN a participant marks a submission as Submitted, THE Platform SHALL make it visible for evaluation and lock it from further edits unless the event is still in 'In Progress' state
5. THE Platform SHALL allow a participant to revert a Submitted entry back to Draft while the event remains in 'In Progress' state
6. IF the event transitions out of 'In Progress' state, THEN THE Platform SHALL automatically finalize all Draft submissions as Submitted

### Requirement 16: Notification and Communication System

**User Story:** As a user, I want timely notifications for all relevant platform events, so that I stay informed about state changes, invitations, disputes, and deadlines.

#### Acceptance Criteria

1. THE Platform SHALL deliver in-app notifications for: event state changes, invitation received, team invitation, dispute filed, dispute resolved, winner announcement, disbursement completed, approaching deadlines
2. THE Platform SHALL send email notifications via Resend for high-priority events: invitation received, winner announcement, dispute filed against your submission, disbursement completed
3. THE Platform SHALL support user notification preferences allowing users to opt out of email notifications per category while retaining in-app notifications
4. WHEN a notification is created, THE Platform SHALL deliver it in real-time to connected clients using Supabase real-time subscriptions
5. THE Platform SHALL paginate notification history and support marking notifications as read individually or in bulk

### Requirement 17: Repository Hygiene and Code Quality

**User Story:** As a developer, I want the repository free of dead code, one-off scripts, and incomplete integrations, so that the codebase is maintainable and every file serves a clear purpose.

#### Acceptance Criteria

1. THE Platform SHALL remove all one-off codemod scripts from the repository root (update_*.cjs, fix_*.cjs, fix_ui.py, run_migrations.cjs, test.js)
2. THE Platform SHALL remove the Firebase/Firestore integration entirely, including firebase-applet-config.json, firebase-blueprint.json, firestore.rules, and all Firestore sync code
3. THE Platform SHALL remove the unused Gmail OAuth integration (googleAuth.ts) and any related dead code
4. THE Platform SHALL remove the dual stellar-sdk v13 dependency, retaining only @stellar/stellar-sdk v16+
5. THE Platform SHALL enforce TypeScript strict mode with no `any` types in production code
6. THE Platform SHALL include ESLint and Prettier configurations with pre-commit hooks enforcing code quality standards
7. THE Platform SHALL maintain a minimum of 80% test coverage on business logic (services, state machine, financial operations) using Vitest

### Requirement 18: Error Handling and API Contract

**User Story:** As a frontend developer, I want consistent, predictable API error responses, so that error handling code is unified and users receive clear feedback.

#### Acceptance Criteria

1. THE Platform SHALL return all successful responses in a consistent envelope: `{ data: { ... } }` for single resources or `{ data: [...], meta: { ... } }` for collections
2. THE Platform SHALL return all error responses in a consistent envelope: `{ error: { code: string, message: string, details?: object } }`
3. THE Platform SHALL use semantically correct HTTP status codes: 201 for creation, 204 for deletion, 400 for bad requests, 401 for unauthenticated, 403 for unauthorized, 404 for not found, 409 for conflicts, 422 for validation failures, 429 for rate limiting, 503 for service unavailable
4. THE Platform SHALL implement a global error handler that catches unhandled exceptions, logs them with request context, and returns a generic 500 error without leaking internal details
5. IF a Zod validation fails, THEN THE Platform SHALL return a 422 response with the specific field errors in the details object

### Requirement 19: Optimistic Concurrency Control

**User Story:** As an organizer editing an event, I want the system to detect concurrent edits, so that one user's changes are not silently overwritten by another.

#### Acceptance Criteria

1. THE Platform SHALL include a version number (or updatedAt timestamp) on all mutable resources (events, submissions, teams)
2. WHEN a client submits an update, THE Platform SHALL require the current version in the request
3. IF the submitted version does not match the stored version, THEN THE Platform SHALL return a 409 Conflict response indicating the resource has been modified since the client's last read
4. THE Platform SHALL increment the version number on every successful update
5. THE Platform SHALL return the current version in all read responses so clients can track it for subsequent updates

### Requirement 20: Observability and Health Checks

**User Story:** As a platform operator, I want structured logging, request tracing, and health check endpoints, so that I can monitor system health, diagnose issues, and ensure reliable operation.

#### Acceptance Criteria

1. THE Platform SHALL generate a unique request ID for every incoming request and propagate it through all log entries for that request
2. THE Platform SHALL emit structured JSON log entries for all write operations including: request ID, operation type, actor, resource affected, and outcome
3. THE Platform SHALL expose a GET /api/health endpoint returning 200 with basic process status (unauthenticated)
4. THE Platform SHALL expose a GET /api/health/ready endpoint returning 200 when the database connection is active, or 503 when unavailable
5. WHEN an error occurs in a request handler, THE Platform SHALL log the full error with stack trace and request context without exposing internal details in the response

### Requirement 21: Sponsor and Milestone Management UI

**User Story:** As an organizer, I want full management UI for sponsors and milestones, so that I can showcase event sponsors and track timeline progress through the frontend.

#### Acceptance Criteria

1. THE Platform SHALL provide a sponsor management interface allowing organizers to add, edit, and remove sponsors with name, logo URL, and tier (Gold, Silver, Bronze)
2. THE Platform SHALL display sponsors publicly on the event page grouped by tier
3. THE Platform SHALL provide a milestone timeline interface allowing organizers to add, edit, and remove milestones with title, date, and description
4. THE Platform SHALL display milestones on the event page in chronological order with visual indicators for past, current, and upcoming milestones
5. WHEN a milestone date passes, THE Platform SHALL send a notification to all event participants

### Requirement 22: Accessibility and Responsive Design

**User Story:** As a user with disabilities or using a mobile device, I want the platform to be accessible and responsive, so that I can fully participate regardless of my device or abilities.

#### Acceptance Criteria

1. THE Platform SHALL achieve WCAG 2.1 Level AA compliance on all interactive elements including: proper ARIA labels on icon-only buttons, focus management on modals and dialogs, keyboard navigation for all workflows
2. THE Platform SHALL implement aria-live regions for dynamic content updates (toast notifications, state changes, real-time updates)
3. THE Platform SHALL provide responsive layouts that adapt to mobile, tablet, and desktop viewports — data tables SHALL collapse to card layouts on mobile
4. THE Platform SHALL ensure all text meets a minimum contrast ratio of 4.5:1 against its background
5. THE Platform SHALL provide loading, empty, and error states for all data-fetching components with appropriate ARIA announcements

### Requirement 23: Complete Event Lifecycle State Machine

**User Story:** As a platform operator, I want a granular event lifecycle covering every phase from draft through archival, so that each stage has defined permissions, validations, allowed actions, and rollback behavior — ensuring no ambiguous or untracked states exist.

#### Acceptance Criteria

1. THE State_Machine SHALL define the following ordered lifecycle states: Draft, Published, Registration Open, Registration Closed, Team Formation, Submission Open, Submission Closed, Judging, Review (Objection Window), Winners Finalized, Organizer Funds Escrow, Escrow Locked, Prize Distribution, Completed, Cancelled, and Archived
2. WHEN a state transition is requested, THE State_Machine SHALL validate that the transition is permitted from the current state according to the canonical transition map before modifying any database record
3. THE State_Machine SHALL enforce preconditions for each transition: Published requires at least one judge assigned, Registration Open requires the event to be Published and a registration deadline configured, Team Formation requires Registration Closed and teamSizeMin configured, Submission Open requires Team Formation complete or Registration Closed (for solo events), Judging requires Submission Closed with at least one submitted entry, Winners Finalized requires all submissions scored, Escrow Locked requires full escrow funding confirmed on-chain, and Prize Distribution requires Escrow Locked and the Review window elapsed without unresolved disputes
4. THE State_Machine SHALL define a permission set per state specifying which roles (Platform Admin, Workspace Owner, Organizer, Judge, Participant) can trigger each outbound transition
5. IF an invalid state transition is requested, THEN THE Platform SHALL return a 422 response containing the current state, the requested state, the list of valid outbound transitions, and any unmet preconditions
6. THE State_Machine SHALL support rollback transitions for reversible states: Published can revert to Draft, Registration Open can revert to Published (if zero registrations exist), and Submission Open can revert to Team Formation (if zero submissions exist)
7. THE State_Machine SHALL allow the Cancelled state to be reached from any non-terminal state (Completed, Archived, and Cancelled are terminal states), with cancellation triggering the refund workflow for funded events
8. WHEN an event reaches Completed state, THE Platform SHALL allow transition to Archived after a configurable retention period (default: 90 days)
9. THE State_Machine SHALL record every state transition in an immutable audit log with the actor, timestamp, previous state, new state, and reason
10. THE Platform SHALL implement the State_Machine as a single TypeScript module shared between server-side route handlers and client-side UI components, eliminating all duplicate state machine implementations

### Requirement 24: Workspace and Organization Management

**User Story:** As a platform operator, I want multiple organizations to manage their events independently with member roles and permissions, so that the platform supports multi-tenant usage with clear ownership boundaries and delegated administration.

#### Acceptance Criteria

1. THE Platform SHALL support Workspace entities with configurable name, description, logo URL, and settings (default timezone, notification preferences, event defaults)
2. WHEN a user creates a Workspace, THE Platform SHALL designate that user as the Workspace_Owner with full administrative authority
3. THE Platform SHALL enforce three Workspace-level roles: Owner (one per workspace, full control), Admin (manage members and events, cannot delete workspace or transfer ownership), and Member (create and manage their own events within the workspace)
4. THE Platform SHALL provide an invitation flow where Workspace Owners and Admins can invite users by email, generating a time-limited invitation link (expiration: 7 days)
5. WHEN a Workspace_Owner initiates ownership transfer, THE Platform SHALL require the target user to be an existing Admin of that workspace and require explicit confirmation from both parties
6. THE Platform SHALL associate every event with exactly one Workspace, inheriting the Workspace's RLS policies such that Workspace members can only access events within their authorized Workspaces
7. THE Platform SHALL prevent Workspace deletion while the Workspace contains events in non-terminal states (any state other than Completed, Cancelled, or Archived)
8. WHEN a member is removed from a Workspace, THE Platform SHALL revoke their access to all events within that Workspace and reassign their organizer-owned events to the Workspace_Owner
9. THE Platform SHALL support a billing ownership model per Workspace (future-ready) with fields for billing email, payment method reference, and billing plan — defaulting to a free tier with no active billing enforcement
10. THE Platform SHALL enforce unique Workspace slugs (URL-safe identifiers) for use in URL routing and API namespacing

### Requirement 25: Wallet and Blockchain Experience

**User Story:** As a user, I want a comprehensive wallet experience supporting multiple providers, network switching, and transaction visibility, so that I can interact with the Stellar blockchain reliably and understand my on-chain activity.

#### Acceptance Criteria

1. THE Platform SHALL define a Wallet_Adapter interface supporting connect, disconnect, sign transaction, and sign message operations — abstracting wallet provider specifics behind a unified API
2. THE Platform SHALL support Freighter wallet as the primary adapter and provide extension points for additional adapters (Albedo, xBull, Rabet) without modifying core wallet logic
3. WHEN a user's wallet session expires or the browser extension becomes unavailable, THE Platform SHALL detect the disconnection and prompt the user to reconnect with a non-blocking notification
4. THE Platform SHALL support wallet switching by requiring a new challenge-response verification flow for the replacement wallet address before updating the stored association
5. THE Platform SHALL support Network_Mode switching between Stellar testnet and mainnet, displaying the active network prominently in the UI and preventing cross-network transaction submissions
6. WHEN a user connects a wallet, THE Platform SHALL display the wallet verification status (Verified, Pending, Unverified) and the connected provider name in the user profile section
7. THE Platform SHALL maintain a transaction history per user showing all on-chain transactions initiated through the platform: funding, disbursement, refund, and escrow operations — each with transaction hash, amount, timestamp, status, and a link to the Stellar block explorer
8. WHEN a blockchain transaction fails (network timeout, insufficient balance, sequence number conflict), THE Platform SHALL display a descriptive error to the user, log the failure with transaction context, and provide a retry action without requiring the user to re-enter transaction details
9. THE Platform SHALL verify wallet signatures using the Stellar SDK Keypair.verify method and reject any signature that does not match the claimed public key
10. THE Platform SHALL prevent any financial operation (fund, disburse, refund) from executing if the initiating user's wallet is not in Verified status

### Requirement 26: Escrow and Funding Lifecycle

**User Story:** As a platform operator, I want a complete escrow lifecycle with defined states, transition rules, and audit trails, so that fund custody is transparent, verifiable, and recoverable at every stage.

#### Acceptance Criteria

1. THE Escrow_Lifecycle SHALL define the following states: Pending Funding, Partially Funded, Fully Funded, Locked, Pending Release, Released, Refunded, Failed, and Cancelled
2. WHEN an organizer initiates funding, THE Escrow_Lifecycle SHALL transition from Pending Funding to Partially Funded upon receiving the first confirmed on-chain deposit, and to Fully Funded when the total deposited amount meets or exceeds the configured prize pool target
3. THE Escrow_Lifecycle SHALL define transition permissions: only the event Organizer or Workspace_Owner can trigger funding; only the Platform transitions to Locked (automated upon event reaching Escrow Locked state); only the Platform triggers Pending Release and Released (automated after successful dispute window); only the Organizer or Platform Admin can trigger Cancelled
4. WHEN the escrow transitions to Locked state, THE Platform SHALL verify the on-chain balance matches the expected funded amount and record the verification timestamp and block height
5. THE Platform SHALL represent escrow state in both the smart contract (on-chain) and the database (off-chain), with a reconciliation check that compares on-chain balance against the database record at every state transition
6. THE Platform SHALL record an Audit_Record for every escrow state transition containing: actor, timestamp, wallet address (if blockchain-related), transaction hash (if on-chain), previous state, new state, and on-chain balance at time of transition
7. IF the on-chain balance does not match the expected database balance during reconciliation, THEN THE Platform SHALL flag the escrow as inconsistent, notify the Platform Admin and Organizer, and prevent further automated transitions until manual review resolves the discrepancy
8. WHEN escrow transitions to Released state, THE Platform SHALL execute prize distribution payments to all eligible winners and record each payment transaction hash
9. IF escrow funding fails (transaction rejected, timeout, or insufficient balance), THEN THE Platform SHALL keep the escrow in its current state, log the failure with full transaction context, and allow the Organizer to retry
10. THE Platform SHALL support partial refunds for cancelled events where some disbursements have already occurred, calculating the refundable amount as the remaining escrow balance after completed disbursements

### Requirement 27: Role Permission Matrix

**User Story:** As a platform operator, I want a comprehensive permission matrix defining what each role can do across all resources, so that access control is explicit, auditable, and enforceable at both API and database layers.

#### Acceptance Criteria

1. THE Platform SHALL define the following platform-wide roles: Platform Admin, Workspace Owner, Organizer, Sponsor, Judge, Mentor, Participant, Team Captain, and Team Member
2. THE Permission_Matrix SHALL define allowed operations per role across these resource categories: Events, Submissions, Evaluations, Teams, Escrow/Funding, Disbursements, Workspaces, Members, Invitations, Sponsors, Milestones, Disputes, and Notifications
3. THE Permission_Matrix SHALL grant Platform Admin full read, write, delete, approve, and reject permissions across all resources in all Workspaces
4. THE Permission_Matrix SHALL grant Workspace_Owner full permissions within their Workspace scope: create/read/update/delete events, manage members, manage billing, transfer ownership, and override Organizer decisions
5. THE Permission_Matrix SHALL grant Organizer permissions within their assigned events: create/edit event details, manage registrations, assign judges, set winners, initiate funding, trigger disbursement, and manage sponsors and milestones
6. THE Permission_Matrix SHALL grant Judge permissions within their assigned events: read submissions, create/update evaluations, and view team compositions — Judges SHALL NOT access escrow details, disbursement amounts, or other judges' scores before the judging period ends
7. THE Permission_Matrix SHALL grant Participant permissions within events they are registered for: create/edit submissions (while submissions are open), form/join teams, view their own evaluations (after judging ends), and file disputes (during the Review window)
8. THE Permission_Matrix SHALL grant Team Captain additional permissions over their team: invite members, remove members, designate a new captain, and submit the team's project on behalf of all members
9. THE Permission_Matrix SHALL grant Sponsor read-only access to event details, participant counts, and submission summaries — Sponsors SHALL NOT access individual participant data, evaluation scores, or escrow operational details
10. THE Platform SHALL enforce the Permission_Matrix through both API middleware (rejecting unauthorized requests with 403 Forbidden) and Supabase RLS policies (preventing unauthorized data access at the database layer)
11. THE Platform SHALL log all permission-denied events with the actor, attempted action, target resource, and required role for security monitoring

### Requirement 28: Notification and Activity Timeline

**User Story:** As a user, I want every important platform action to generate notifications, audit log entries, and activity timeline entries, so that I have full visibility into what happened, when, and by whom.

#### Acceptance Criteria

1. THE Platform SHALL generate an in-app notification, an Audit_Record, and an Activity_Timeline entry for each of the following events: wallet connected, wallet disconnected, escrow funded, escrow locked, submission uploaded, submission updated, judging started, judging completed, winner announced, escrow released, dispute opened, dispute resolved, milestone approved, role changed, team formed, team member joined, team member removed, member invited, member removed, and event state transitioned
2. WHEN a notification is created, THE Platform SHALL deliver it in real-time to connected clients using Supabase real-time subscriptions with a maximum delivery latency of 5 seconds
3. THE Platform SHALL display the Activity_Timeline as a chronological feed within each event, showing the action type, actor name, timestamp, and a human-readable description — accessible to all event members based on their role permissions
4. THE Platform SHALL store Audit_Records as append-only (immutable) database entries with no update or delete operations permitted, enforced through database-level constraints and RLS policies
5. THE Platform SHALL support notification delivery via email (using Resend) for high-priority events: dispute filed, winner announcement, disbursement completed, escrow inconsistency detected, and invitation received
6. THE Platform SHALL allow users to configure notification preferences per category (event updates, team activity, financial activity, disputes) with the option to disable email delivery while retaining in-app notifications
7. WHEN a financial action generates an Audit_Record, THE Platform SHALL include the transaction hash, wallet address, amount, and on-chain confirmation status in the record metadata
8. THE Platform SHALL support querying Audit_Records by actor, action type, resource, date range, and event — with paginated results and export capability in CSV and JSON formats

### Requirement 29: Role-Specific Dashboards

**User Story:** As a user, I want a dashboard tailored to my role showing relevant KPIs, quick actions, and status summaries, so that I can efficiently manage my responsibilities without navigating through unrelated information.

#### Acceptance Criteria

1. THE Platform SHALL render a role-appropriate Dashboard as the default authenticated landing page, adapting content based on the user's highest-privilege role in their active Workspace
2. THE Platform Admin Dashboard SHALL display: total active events across all Workspaces, total registered users, total escrowed funds (on-chain aggregate), flagged escrow inconsistencies requiring review, pending disputes, and system health status — with quick actions for user management, workspace oversight, and dispute resolution
3. THE Workspace Dashboard SHALL display: events grouped by lifecycle state, total members, pending invitations, aggregate escrow status across workspace events, and recent Activity_Timeline entries — with quick actions for creating events, inviting members, and managing workspace settings
4. THE Organizer Dashboard SHALL display: their events with current state and next required action, registration counts per event, submission progress (submitted vs. draft), escrow funding status, unresolved disputes, and approaching deadlines — with quick actions for advancing event state, managing teams, and initiating disbursement
5. THE Judge Dashboard SHALL display: assigned events awaiting evaluation, number of submissions pending review, scoring progress (completed vs. remaining), judging deadline, and conflict-of-interest flags — with quick actions for accessing submission review and submitting evaluations
6. THE Sponsor Dashboard SHALL display: events they are sponsoring, participant counts, submission counts, event progress status, and their sponsor tier and logo placement preview — accessible as read-only with no administrative actions
7. THE Participant Dashboard SHALL display: registered events with current state, team membership status, submission status (draft/submitted), evaluation results (when available), prize allocation (if winner), and upcoming deadlines — with quick actions for editing submissions, managing team, and viewing results
8. WHEN a user holds multiple roles across different events, THE Platform SHALL present a unified dashboard aggregating information from all active roles with clear role context labels per section

### Requirement 30: File and Submission Management

**User Story:** As a participant, I want comprehensive submission management with drafts, version history, and file validation, so that I can iterate on my work confidently and submit files that meet event requirements.

#### Acceptance Criteria

1. THE Platform SHALL support submission draft auto-save at configurable intervals (default: 30 seconds) persisting the current form state to the database without requiring explicit user action
2. THE Platform SHALL maintain a version history for each submission, storing the full submission content at each save point with a version number, timestamp, and actor — allowing comparison between any two versions
3. THE Platform SHALL enforce resubmission rules per event: the Organizer configures whether resubmission is allowed after initial submission, the maximum number of resubmissions permitted (default: unlimited while submissions are open), and whether resubmission resets judge evaluations
4. THE Platform SHALL validate file attachments before accepting uploads: permitted file types configured per event (default: PDF, PNG, JPG, MP4, ZIP, with maximum 10 file types), maximum file size per attachment (default: 50 MB), maximum total submission size (default: 200 MB), and filename sanitization removing special characters
5. IF a file attachment fails validation (unsupported type, exceeds size limit, or contains disallowed characters in filename), THEN THE Platform SHALL reject the upload with a 422 response specifying which validation rule was violated
6. THE Platform SHALL support evidence file uploads for disputes, applying the same validation rules as submission attachments and associating uploaded evidence with the specific dispute record
7. THE Platform SHALL generate preview thumbnails for image files (PNG, JPG) and render PDF previews in-browser without requiring file download — video attachments SHALL display an embedded player for supported formats (MP4, WebM)
8. WHEN a submission version is created, THE Platform SHALL store a diff summary describing what changed between the current and previous version (fields modified, files added/removed)

### Requirement 31: Audit and Transparency

**User Story:** As a platform operator, I want every financial and administrative action to generate immutable audit records with full context, so that the platform maintains a verifiable, tamper-evident history for compliance, dispute resolution, and trust.

#### Acceptance Criteria

1. THE Platform SHALL generate an Audit_Record for every financial action (fund, disburse, refund, escrow lock, escrow release) and every administrative action (role change, member removal, event state transition, permission override, dispute resolution, winner modification)
2. THE Audit_Record SHALL contain the following fields: actor (user ID and display name), timestamp (UTC with millisecond precision), action type (enumerated string), target resource (type and ID), wallet address (if blockchain-related), transaction hash (if on-chain), before state (JSON snapshot of affected fields), after state (JSON snapshot of affected fields), reason (optional text description), and request metadata (IP address, user agent, request ID)
3. THE Platform SHALL store Audit_Records in an append-only table with no UPDATE or DELETE permissions granted to any role including Platform Admin — enforced through PostgreSQL table permissions and triggers that reject modification attempts
4. THE Platform SHALL support querying Audit_Records with filters for: actor, action type, target resource, date range, event scope, and workspace scope — returning paginated results sorted by timestamp descending
5. THE Platform SHALL support exporting Audit_Records in CSV and JSON formats for compliance reporting, with export access restricted to Platform Admin and Workspace_Owner roles
6. WHEN an Audit_Record references an on-chain transaction, THE Platform SHALL include a verification link to the Stellar block explorer and store the on-chain confirmation status (confirmed, pending, failed)
7. THE Platform SHALL retain all Audit_Records for a minimum of 7 years with no automated purge, supporting regulatory compliance requirements for financial platforms
8. IF an actor attempts to modify or delete an Audit_Record through any mechanism, THEN THE Platform SHALL reject the operation and generate a security alert notification to all Platform Admin users

### Requirement 32: Future Scalability and Extensibility

**User Story:** As a platform architect, I want the system designed with explicit extension points and API-first architecture, so that future features (AI modules, mobile apps, multi-chain support, enterprise integrations) can be added without major refactoring of core systems.

#### Acceptance Criteria

1. THE Platform SHALL define a Plugin interface with lifecycle hooks (onInstall, onUninstall, onEventStateChange, onSubmissionCreate, onEvaluationComplete) enabling third-party extensions to react to platform events without modifying core code
2. THE Platform SHALL expose a versioned public REST API (beginning with /api/v1/) with API key authentication, rate limiting per key (default: 1000 requests per hour), and usage tracking per key for third-party integrations
3. THE Platform SHALL implement a Webhook system allowing Workspace Owners to register HTTP callback URLs for specific event types, with payload signing (HMAC-SHA256), delivery retry (3 attempts with exponential backoff), and delivery status tracking
4. THE Platform SHALL structure all API endpoints to return JSON responses consumable by any HTTP client (web, mobile, CLI) without browser-specific dependencies, enabling future React Native or native mobile app development
5. THE Platform SHALL abstract blockchain operations behind a chain adapter interface (similar to Wallet_Adapter) supporting future addition of Ethereum, Solana, and other networks without modifying escrow business logic
6. THE Platform SHALL support enterprise authentication integration points: SAML 2.0, OIDC (OpenID Connect), and API-based SSO — configurable per Workspace with fallback to standard Supabase Auth
7. THE Platform SHALL define extension points for AI-assisted features: submission analysis (plagiarism detection, quality scoring), judging assistance (suggested scores with rationale), and event analytics (participation predictions, engagement metrics) — accessible through the Plugin interface
8. THE Platform SHALL support white-label configuration per Workspace: custom domain, custom logo, custom color scheme, and custom email sender address — applied through workspace settings without code deployment
9. THE Platform SHALL maintain backward-compatible API versioning: new API versions add fields and endpoints without removing existing ones; deprecated fields are marked with sunset dates and remain functional for a minimum of 6 months
10. THE Platform SHALL implement a feature flag system allowing gradual rollout of new capabilities per Workspace, enabling A/B testing and staged releases without deploying separate codebases


### Requirement 33: Wallet Experience and Web3 User Journey

**User Story:** As a user interacting with blockchain features, I want a complete, production-quality wallet experience with guided onboarding, clear feedback at every step, and graceful error recovery, so that I feel confident and informed when connecting wallets, signing transactions, and managing on-chain activity — regardless of my prior Web3 experience.

#### Acceptance Criteria

1. THE Platform SHALL integrate Freighter Wallet as the primary Stellar wallet provider, detecting its browser extension presence and displaying an installation prompt with a direct link to the Freighter extension store page when not detected
2. THE Platform SHALL implement a Wallet_Adapter architecture that abstracts provider-specific logic behind a unified interface (connect, disconnect, signTransaction, signMessage, getPublicKey, getNetwork), enabling future addition of Albedo, xBull, Rabet, and other Stellar wallet providers without modifying consumer code
3. WHEN a first-time user initiates wallet connection, THE Platform SHALL display a guided onboarding flow explaining: what a wallet is, why connection is needed, what permissions are being requested, and what the user can expect after connecting — with the option to skip the guide on subsequent visits
4. THE Platform SHALL display distinct connection states in the UI: Disconnected (no wallet linked), Connecting (awaiting user approval in wallet extension), Connected (wallet linked but unverified), Verified (challenge-response ownership proof completed), and Error (connection failed with descriptive reason)
5. WHEN a wallet connection is established, THE Platform SHALL persist the session such that the user does not need to re-authorize the wallet extension on page reload or navigation — reconnection SHALL happen automatically and silently until the user explicitly disconnects or the extension becomes unavailable
6. IF the Freighter extension becomes unavailable during a session (extension disabled, browser crashed, or extension updated), THEN THE Platform SHALL detect the disconnection within 5 seconds, display a non-blocking warning notification with the reason, and offer a one-click reconnection action
7. THE Platform SHALL support wallet switching by guiding the user through: disconnect confirmation for the current wallet, new wallet selection, challenge-response verification for the new wallet, and confirmation of the switch — preserving all non-wallet-related account data
8. THE Platform SHALL detect the active Stellar network (testnet or mainnet) from the connected wallet and display the active network prominently in the UI header — IF the wallet's active network does not match the platform's configured network, THEN THE Platform SHALL display a warning and provide instructions for switching networks in the wallet extension
9. WHEN the user initiates any blockchain transaction (fund escrow, approve disbursement, claim prize), THE Platform SHALL display a pre-signing confirmation dialog showing: transaction type, amount, source wallet, destination address, network, and estimated fees — requiring explicit user confirmation before prompting the wallet extension to sign
10. WHILE a blockchain transaction is processing, THE Platform SHALL display a multi-stage progress indicator showing: Preparing Transaction → Awaiting Signature → Broadcasting → Confirming (with block explorer link) → Completed or Failed
11. IF a blockchain transaction fails (insufficient balance, network timeout, user rejected signing, sequence number conflict, or fee bump required), THEN THE Platform SHALL display a user-friendly error message explaining the failure in non-technical language, log the technical failure details for debugging, and provide a contextual recovery action (retry, adjust amount, or contact support) without requiring the user to re-enter transaction details
12. THE Platform SHALL maintain a visible transaction history per user accessible from the wallet section of their profile, showing all platform-initiated on-chain transactions with: type, amount, timestamp, status (pending/confirmed/failed), counterparty address (truncated with copy action), and a link to the Stellar block explorer for each transaction
13. THE Platform SHALL display wallet verification status prominently in the user profile and wherever the wallet address is shown (settings, event participation, winner list), using visual indicators: a green verified badge for challenge-response verified wallets, an amber pending badge for connected-but-unverified wallets, and no badge for disconnected state
14. THE Platform SHALL provide user-friendly explanations for all blockchain actions, avoiding raw technical jargon — for example: "Fund Escrow" instead of "Submit Payment Operation", "Your prize is ready to claim" instead of "Incoming claimable balance", and "Waiting for network confirmation" instead of "Pending ledger close"
15. THE Platform SHALL handle multi-device scenarios by storing wallet association at the account level (not browser session level) — if a user logs in from a new device, THE Platform SHALL prompt them to reconnect their wallet via the same challenge-response flow while displaying their verified wallet address as a reference
16. THE Platform SHALL implement a wallet health check on application load that verifies: the extension is installed, the extension is accessible (not locked), the connected account matches the stored verified address, and the active network matches the platform configuration — displaying actionable guidance for any detected mismatch

