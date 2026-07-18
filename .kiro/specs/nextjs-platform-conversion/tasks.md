# Implementation Plan: Next.js Platform Conversion

## Overview

This plan converts Stellar Guardian from a React 19 + Vite SPA / Express 4 backend into a Next.js App Router full-stack application on Supabase PostgreSQL. Implementation proceeds bottom-up: foundation and tooling first, then the shared type system, database schema and RLS, the pure shared modules (state machine, permission matrix, error model), then the server services (wallet, chain, escrow, dispute, idempotency, notification/audit), then the split paginated API endpoints, and finally the frontend dashboards and wallet UI. Each service is implemented alongside the property-based tests that validate its correctness properties.

All code is TypeScript. Property-based tests use **fast-check** integrated with **Vitest**, each tagged in the format `// Feature: nextjs-platform-conversion, Property N: {property_text}` and run with a minimum of 100 iterations. Every one of the 53 correctness properties from the design has exactly one dedicated property test sub-task below.

Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP, though they are strongly recommended for financial correctness.

## Tasks

- [ ] 1. Project foundation and tooling
  - [-] 1.1 Scaffold Next.js App Router project and directory structure
    - Initialize Next.js App Router app with the `/app`, `/components`, `/lib`, `/types`, `/supabase/migrations` structure
    - Create route-group skeletons: `/(public)/discover`, `/(auth)`, `/(app)`, and `/app/api/**` placeholders
    - Confirm a single deployable artifact with no separate backend process
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7_

  - [~] 1.2 Configure TypeScript strict mode, linting, and the test toolchain
    - Enable TS strict mode with no `any` in production code
    - Add ESLint + Prettier configs and pre-commit hooks
    - Install and configure Vitest as the test runner and fast-check for property-based tests
    - Add the property-test tagging convention and a shared 100-iteration fast-check config helper
    - _Requirements: 17.5, 17.6, 17.7_

  - [~] 1.3 Remove dead integrations and duplicate dependencies
    - Remove Firebase/Firestore integration (`firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.rules`, sync code) and the previously committed secret file
    - Remove the Gmail OAuth integration (`googleAuth.ts`) and related dead code
    - Remove the duplicate `stellar-sdk` v13 dependency, retaining only `@stellar/stellar-sdk` v16+
    - Remove one-off codemod scripts from the repo root (`update_*.cjs`, `fix_*.cjs`, `fix_ui.py`, `run_migrations.cjs`, `test.js`)
    - _Requirements: 4.7, 14.4, 14.7, 17.1, 17.2, 17.3, 17.4_

- [ ] 2. Shared Zod type system
  - [~] 2.1 Define Zod schemas as the single source of truth in `/types`
    - Author Zod schemas for all entities (users, wallets, workspaces, events, teams, submissions, evaluations, escrow, transactions, disputes, notifications, audit records) and API request/response envelopes
    - Derive TypeScript types via `z.infer`; re-export validation schemas from `/lib/validation`
    - _Requirements: 1.5_

  - [ ]* 2.2 Write unit tests for schema inference and validation
    - Verify representative schemas parse valid input and reject invalid input with field errors
    - _Requirements: 1.5_

- [ ] 3. Supabase clients, migrations, and RLS
  - [~] 3.1 Implement Supabase client factories
    - Implement `createBrowserClient`, `createServerClient` (wired to `next/headers` cookies), and server-only `createServiceClient`
    - Ensure the server client calls `auth.getClaims()` immediately after creation with no intervening code
    - _Requirements: 2.1, 3.1, 3.2_

  - [~] 3.2 Author initial database migrations for all core tables
    - Create Supabase CLI migrations (up/down) for all tables with foreign keys, indexes on frequently queried columns, CHECK constraints for enumerated values, `timestamptz` UTC timestamps, and `version` columns on mutable resources
    - Include partial unique indexes (one workspace Owner, one team per participant per event) and the GIN full-text index on events
    - _Requirements: 2.2, 2.4, 2.7, 19.1_

  - [~] 3.3 Implement RLS policies and append-only audit enforcement
    - Enable RLS on every table with policies using `(select auth.uid())` mirroring the permission matrix
    - Add append-only enforcement for `audit_records` (no UPDATE/DELETE grants + BEFORE UPDATE/DELETE triggers) and deny-by-default modification for escrow secret data
    - Add `notifications`, `events`, and `teams` to the `supabase_realtime` publication
    - _Requirements: 2.3, 2.5, 27.10, 31.3, 31.8_

  - [ ]* 3.4 Write integration tests for RLS parity and migration dry-run
    - Verify a request permitted by `can()` is permitted by RLS and a denied one is blocked at the DB layer
    - Verify up/down migration dry-run succeeds
    - _Requirements: 2.4, 2.3, 27.10_

  - [~] 3.5 Implement authentication pages and session flow
    - Build the `/(auth)/login` and `/(auth)/signup` pages, filling in the route skeletons from task 1.1, with email/password registration and login calling Supabase Auth via the browser client, and wire client-side automatic token refresh
    - _Requirements: 3.1, 3.2_

  - [ ]* 3.6 Write unit tests for authentication pages and session flow
    - Test signup and login success paths, failure paths (invalid credentials, duplicate email, weak password), and automatic client-side token refresh
    - _Requirements: 3.1, 3.2_

- [ ] 4. Shared state machine module
  - [~] 4.1 Implement the event lifecycle state machine
    - Implement `canTransition`, `validOutboundStates`, `isTerminal` over the 16 canonical states with Req 23.3 preconditions, rollback transitions, and terminal-state rules as a pure module importable by server and client
    - Eliminate the duplicate `server.ts` `VALID_TRANSITIONS` and `src/lib/eventStatus.ts` implementations
    - _Requirements: 6.2, 6.3, 23.1, 23.2, 23.3, 23.6, 23.7, 23.10_

  - [ ]* 4.2 Write property test for valid-only event transitions
    - **Property 1: Transitions occur only when valid and preconditions are met**
    - **Validates: Requirements 6.3, 23.2, 23.3**

  - [ ]* 4.3 Write property test for terminal and rollback invariants
    - **Property 4: Terminal and rollback invariants hold**
    - **Validates: Requirements 23.6, 23.7**

  - [~] 4.4 Implement the escrow lifecycle state machine
    - Implement `canEscrowTransition` over the 9 escrow states with cumulative-funding-driven transitions (PendingFunding → PartiallyFunded → FullyFunded)
    - _Requirements: 26.1, 26.2, 26.4_

  - [ ]* 4.5 Write property test for cumulative-funding escrow state
    - **Property 12: Cumulative funding drives escrow state**
    - **Validates: Requirements 26.1, 26.2, 26.4**

  - [~] 4.6 Implement the dispute lifecycle state machine
    - Implement `canDisputeTransition` with role- and filer-gated transitions and terminal state set
    - _Requirements: 39.1, 39.3, 39.4_

- [ ] 5. Error model, response envelope, and permission matrix
  - [~] 5.1 Implement the typed error hierarchy and global error handler
    - Implement `AppError` subclasses with stable codes and canonical HTTP statuses, and a single global handler mapping errors to `{ error: { code, message, details? } }`
    - Implement success envelopes `{ data }` and `{ data, meta }` with correct status mapping (201/204/400/401/403/404/409/422/429/503)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 20.5_

  - [ ]* 5.2 Write property test for the canonical envelope and status mapping
    - **Property 27: Responses use the canonical envelope and status mapping**
    - **Validates: Requirements 12.2, 18.1, 18.2, 18.3**

  - [ ]* 5.3 Write property test for leak-free 500 on unhandled exceptions
    - **Property 30: Unhandled exceptions yield a leak-free 500**
    - **Validates: Requirements 18.4, 20.5**

  - [~] 5.4 Implement the permission matrix and authorize helper
    - Implement the declarative `PlatformRole × ResourceCategory × Action` matrix with `can()` and the single `authorize()`/`requireOrganizer()` helper replacing the 15+ inline organizer checks
    - Emit an audit permission-denied record on 403
    - _Requirements: 3.3, 3.6, 3.7, 12.6, 27.1, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8, 27.9, 27.11_

  - [ ]* 5.5 Write property test for permission-matrix scope enforcement
    - **Property 31: No role exceeds its declared permission scope**
    - **Validates: Requirements 3.3, 3.6, 12.6, 27.1, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8, 27.9**

- [ ] 6. Request pipeline middleware
  - [~] 6.1 Implement authentication, validation composition, and request tracing
    - Implement Next.js middleware performing authenticate → rate limit → security headers, attaching a unique request ID, and the per-route `authenticate → authorize → validate → handle` composition
    - Return 401 with the structured envelope on protected routes without a valid token; emit structured JSON logs for all writes including request ID
    - _Requirements: 1.4, 3.4, 3.5, 20.1, 20.2_

  - [ ]* 6.2 Write property test for Zod input rejection
    - **Property 29: Invalid input is rejected with 422 and field details**
    - **Validates: Requirements 12.5, 14.3, 18.5, 30.5**

  - [ ]* 6.3 Write property test for request-ID propagation and write logging
    - **Property 53: Request IDs propagate and writes are logged**
    - **Validates: Requirements 20.1, 20.2**

  - [~] 6.4 Implement rate limiting and security headers
    - Enforce rate limits (auth 10/15min, general API 200/15min per IP, event creation 10/24h, public API key 1000/hour) returning 429
    - Apply CSP (no `unsafe-inline` scripts, nonce-based), HSTS, CORS restricted to configured origins, and CSRF protection on state-mutating routes
    - _Requirements: 14.1, 14.2, 14.5, 14.8, 14.9, 32.2, 36.3_

  - [ ]* 6.5 Write property test for rate-limit thresholds
    - **Property 47: Rate limits reject once thresholds are exceeded**
    - **Validates: Requirements 14.2, 32.2, 36.3**

- [ ] 7. Wallet adapter and verifier
  - [~] 7.1 Implement the wallet adapter interface and Freighter adapter
    - Implement `WalletAdapter` (connect, disconnect, sign transaction, sign message) with a Freighter primary adapter and a registry exposing extension points for Albedo/xBull/Rabet
    - _Requirements: 25.1, 25.2, 33.1, 33.2_

  - [~] 7.2 Implement the server-side challenge-response wallet verifier
    - Issue a 32-byte nonce with 5-minute expiry keyed to user + claimed address; verify via `Keypair.verify`; persist wallet as `Verified` only on success; require fresh challenge-response for address changes
    - Implement `/api/auth/wallet/challenge` and `/api/auth/wallet/verify` route handlers
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 25.4, 25.9, 33.15_

  - [ ]* 7.3 Write property test for challenge signature round-trip
    - **Property 5: Challenge signature verification round-trip**
    - **Validates: Requirements 5.2, 5.3, 5.4, 25.9**

  - [ ]* 7.4 Write property test for expired-challenge rejection
    - **Property 6: Expired challenges are rejected**
    - **Validates: Requirements 5.1, 5.5**

  - [ ]* 7.5 Write property test for verified-only-via-challenge-response
    - **Property 7: Wallets are Verified only via completed challenge-response**
    - **Validates: Requirements 5.6, 5.7, 25.4**

- [ ] 8. Chain adapter and Stellar client
  - [~] 8.1 Implement the chain adapter and Stellar client
    - Implement `ChainAdapter` (verifySignature, getBalance, submitSignedTx, getTransaction, buildPaymentBatch, explorerUrl) using `@stellar/stellar-sdk` v16+ exclusively
    - Make network mode configuration-driven, prevent cross-network submissions, and disable mainnet financial operations until explicitly enabled per environment
    - _Requirements: 4.7, 17.4, 25.5, 34.3_

  - [ ]* 8.2 Write property test for cross-network submission blocking
    - **Property 11: Cross-network submissions are blocked**
    - **Validates: Requirements 25.5**

- [ ] 9. Idempotency and optimistic concurrency
  - [~] 9.1 Implement the idempotency service
    - Require an `Idempotency-Key` header on financial endpoints; insert under a DB unique constraint before executing; return the stored response on replay; return 409 on same-key-different-body; enforce a 24-hour TTL
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 9.2 Write property test for idempotent replay
    - **Property 24: Financial operations are idempotent under key replay**
    - **Validates: Requirements 13.1, 13.2, 13.5**

  - [ ]* 9.3 Write property test for reused-key conflict
    - **Property 25: Reused key with a different body is a conflict**
    - **Validates: Requirements 13.4**

  - [~] 9.4 Implement optimistic concurrency control
    - Require the current version on updates; increment on success; reject stale writes with 409; return current version in read responses; apply to winner-assignment and disbursement-trigger operations
    - _Requirements: 19.2, 19.3, 19.4, 19.5, 19.6_

  - [ ]* 9.5 Write property test for optimistic concurrency
    - **Property 26: Optimistic concurrency detects stale writes**
    - **Validates: Requirements 19.2, 19.3, 19.4, 19.6**

- [~] 10. Checkpoint - foundation and shared modules
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Notification, audit, and activity services
  - [~] 11.1 Implement the append-only audit service
    - Write append-only audit records with all mandatory fields; include tx hash, wallet, amount, and on-chain confirmation status for financial actions; support filtered paginated queries and CSV/JSON export with 7-year retention
    - _Requirements: 11.5, 23.9, 26.6, 27.11, 28.1, 28.7, 31.1, 31.2, 31.4, 31.5, 31.6, 31.7, 39.5_

  - [ ]* 11.2 Write property test for complete immutable audit records
    - **Property 32: Every audited action produces a complete, immutable record**
    - **Validates: Requirements 11.5, 23.9, 26.6, 27.11, 28.1, 28.7, 31.1, 31.2, 31.6, 39.5**

  - [ ]* 11.3 Write property test for audit immutability
    - **Property 33: Audit records cannot be modified or deleted**
    - **Validates: Requirements 28.4, 31.3, 31.8**

  - [~] 11.4 Implement the notification and activity-timeline service
    - Create in-app notifications, deliver via Supabase realtime (≤5s) with 15s polling fallback for non-critical categories, and send email via Resend for high-priority categories honoring per-category preferences; batch non-urgent into an hourly digest while urgent categories deliver immediately; derive the chronological activity timeline
    - _Requirements: 2.8, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 28.2, 28.3, 28.5, 28.6_

  - [ ]* 11.5 Write property test for notification preference gating
    - **Property 34: Notification preferences gate email but never in-app**
    - **Validates: Requirements 16.1, 16.2, 16.3, 28.5, 28.6**

  - [ ]* 11.6 Write property test for urgent-vs-digest delivery
    - **Property 35: Urgent notifications deliver immediately, non-urgent are digested**
    - **Validates: Requirements 16.6**

- [ ] 12. Escrow service
  - [~] 12.1 Implement escrow keypair generation and funding verification
    - Generate a per-event escrow keypair storing only the public key with the secret KMS-envelope-encrypted; require the acting user's verified wallet as funding source (never the platform key); verify the funding tx on-chain within 5 minutes; record the on-chain hash as canonical; keep the event in Draft on failure and notify; record both signer and organizer when funding on behalf
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9, 26.9_

  - [ ]* 12.2 Write property test for financial-operation wallet requirement
    - **Property 8: Financial operations require a Verified wallet**
    - **Validates: Requirements 3.8, 25.10**

  - [ ]* 12.3 Write property test for verified-wallet funding source
    - **Property 9: Funding source is always the acting user's verified wallet**
    - **Validates: Requirements 4.1, 4.8**

  - [ ]* 12.4 Write property test for canonical on-chain funding hash
    - **Property 10: On-chain hash is the canonical funding reference**
    - **Validates: Requirements 4.4**

  - [~] 12.5 Implement escrow reconciliation and public verification endpoint
    - Compare on-chain balance to DB record at every transition; flag `inconsistent`, notify admin + organizer, and block further automated transitions on mismatch; expose the public `/events/[id]/verify-escrow` on-chain balance and history endpoint
    - _Requirements: 4.6, 26.5, 26.7_

  - [ ]* 12.6 Write property test for reconciliation mismatch flagging
    - **Property 13: Reconciliation mismatch flags and blocks**
    - **Validates: Requirements 26.5, 26.7**

  - [~] 12.7 Implement prize allocation validation
    - Accept a winner/prize set if and only if the sum of prizes is ≤ confirmed on-chain balance; reject with 422 reporting balance and attempted total
    - _Requirements: 8.1, 8.2_

  - [ ]* 12.8 Write property test for allocation bounded by balance
    - **Property 14: Prize allocation is bounded by escrow balance**
    - **Validates: Requirements 8.1, 8.2**

  - [~] 12.9 Implement batched disbursement
    - Pay each winner with a verified wallet from the escrow account recording each tx hash; skip unverified winners holding their allocation (optionally via claimable balance) and notify the organizer; partition into ≤100-op batches with all-or-nothing per-batch commit and a reconciliation record preventing double payment under retry; mark the event Completed with on-chain proof when done
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7, 26.8_

  - [ ]* 12.10 Write property test for verified-pay / unverified-hold disbursement
    - **Property 15: Disbursement pays verified winners and holds the rest**
    - **Validates: Requirements 8.3, 8.4, 8.5, 26.8**

  - [ ]* 12.11 Write property test for all-or-nothing batched disbursement
    - **Property 16: Batched disbursement is all-or-nothing with no double payment**
    - **Validates: Requirements 8.6, 8.7**

  - [~] 12.12 Implement the refund path and deletion guard
    - Refund the remaining balance (after completed disbursements) to the original funding wallet on cancellation; verify on-chain; retry up to 3 times with exponential backoff; on final failure set `Cancellation Pending` and alert organizer + admins with the escrow public key; block deletion while a refund is pending or unconfirmed
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 26.10_

  - [ ]* 12.13 Write property test for refund to original funder
    - **Property 17: Refund returns the remaining balance to the original funder**
    - **Validates: Requirements 9.1, 9.3, 26.10**

  - [ ]* 12.14 Write property test for deletion blocked during refund
    - **Property 18: Deletion is blocked while a refund is unresolved**
    - **Validates: Requirements 9.6**

- [~] 13. Checkpoint - financial core
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Dispute service and objection window
  - [~] 14.1 Implement the dispute service and objection window
    - Create disputes in `Open` only for accepted participants while the event is in Review (Objection Window); notify organizer and judges; enforce role-gated transitions; record every transition in an audit record; validate window duration within [24,168] hours defaulting to 72
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 39.2, 39.3, 39.4, 39.5, 39.10_

  - [ ]* 14.2 Write property test for open-by-accepted-participant-in-window
    - **Property 19: Disputes are filed as Open only by accepted participants during the window**
    - **Validates: Requirements 7.1, 7.3, 39.2**

  - [ ]* 14.3 Write property test for role-gated dispute transitions
    - **Property 20: Dispute transitions are role-gated**
    - **Validates: Requirements 39.3, 39.4, 39.10**

  - [ ]* 14.4 Write property test for review-window duration validation
    - **Property 23: Review window duration is validated**
    - **Validates: Requirements 7.2**

  - [~] 14.5 Implement disbursement-blocking and window-elapse resolution
    - Block transition to `PrizeDistribution` and disbursement while the window has not elapsed or any dispute is Open/UnderReview; require winner/prize re-evaluation for Upheld disputes; auto-transition to `Completed` on elapse with no unresolved disputes, otherwise remain in Review and notify the organizer
    - _Requirements: 7.5, 7.6, 7.7, 8.3, 39.6, 39.7, 39.8, 39.9_

  - [ ]* 14.6 Write property test for disbursement blocked until window clears
    - **Property 21: Disbursement is blocked until the window elapses with no unresolved disputes**
    - **Validates: Requirements 7.7, 8.3, 39.6, 39.7, 39.8, 39.9**

  - [ ]* 14.7 Write property test for window-elapse resolution
    - **Property 22: Window elapse resolves to the correct state**
    - **Validates: Requirements 7.5, 7.6**

- [ ] 15. Teams, judging, and submissions services
  - [~] 15.1 Implement the team formation and management service
    - Create teams (creator becomes captain and first member); enforce `teamSizeMax` and one-team-per-participant-per-event; invitation/accept/leave flows with captain transfer to earliest-joined member; associate team submissions with edit access for all members
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 15.2 Write property test for team membership invariants
    - **Property 36: Team membership invariants hold**
    - **Validates: Requirements 10.2, 10.4, 10.7**

  - [ ]* 15.3 Write property test for captain lifecycle
    - **Property 37: Captain lifecycle is well-defined**
    - **Validates: Requirements 10.1, 10.5**

  - [~] 15.4 Implement the judging and conflict-of-interest service
    - Reject scoring with `CONFLICT_OF_INTEREST` when the judge is a member of the submitting team; exclude COI-flagged evaluations from averages; prevent a user holding both Judge and Participant on one event; log COI rejections
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 15.5 Write property test for conflict-of-interest scoring
    - **Property 38: Conflict-of-interest scoring is rejected and excluded**
    - **Validates: Requirements 11.1, 11.2, 11.4**

  - [ ]* 15.6 Write property test for judge/participant exclusivity
    - **Property 39: A user cannot be both Judge and Participant on one event**
    - **Validates: Requirements 11.3**

  - [~] 15.7 Implement the submission draft and versioning service
    - Support Draft/Submitted states with drafts hidden from judges/organizer and freely editable; lock Submitted entries and allow revert only while SubmissionOpen; auto-finalize drafts on SubmissionClosed; append immutable version rows with incrementing numbers and accurate diff summaries; auto-save at configurable intervals
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 30.1, 30.2, 30.3, 30.8_

  - [ ]* 15.8 Write property test for hidden editable drafts
    - **Property 40: Draft submissions are hidden and freely editable**
    - **Validates: Requirements 15.2, 15.3**

  - [ ]* 15.9 Write property test for submission lock and finalize
    - **Property 41: Submitted entries lock and revert only while submissions are open**
    - **Validates: Requirements 15.4, 15.5, 15.6**

  - [ ]* 15.10 Write property test for append-only versioning with diffs
    - **Property 42: Submission versioning is append-only with accurate diffs**
    - **Validates: Requirements 30.2, 30.8**

  - [~] 15.11 Implement file validation, malware scanning, and upload pipeline
    - Validate uploads by content-inspected (magic-byte) MIME type, per-file and total size limits, and filename sanitization, rejecting with 422 identifying the violated rule; apply the same rules to dispute evidence; scan uploaded banner images and attachments for malware before storage, rejecting and notifying the uploader on a failed scan; generate image/PDF previews and video players
    - _Requirements: 30.4, 30.5, 30.6, 30.7, 36.1, 36.4_

  - [ ]* 15.12 Write property test for file validation
    - **Property 43: File validation accepts only conforming uploads**
    - **Validates: Requirements 30.4, 30.5, 30.6, 36.4**

- [ ] 16. Workspaces, discovery, and compliance services
  - [~] 16.1 Implement the workspace management service
    - Create workspaces (creator becomes Owner) with unique slugs; enforce Owner/Admin/Member roles; invitation links expiring at 7 days; ownership transfer requiring an existing Admin and both-party confirmation; block deletion while owned events are non-terminal; on member removal revoke event access and reassign organizer-owned events to the Owner; free-tier billing fields and feature flags
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 24.10_

  - [ ]* 16.2 Write property test for workspace guards and identifiers
    - **Property 44: Workspace guards and identifiers hold**
    - **Validates: Requirements 24.2, 24.4, 24.5, 24.7, 24.10**

  - [ ]* 16.3 Write property test for member removal and reassignment
    - **Property 45: Member removal revokes access and reassigns events**
    - **Validates: Requirements 24.8**

  - [~] 16.4 Implement event discovery and search
    - Return only public non-terminal events (excluding Draft/Cancelled) matching filters (category/format/tag/funding-status) with the search term in title/description/tags, ordered by the selected sort key, using the full-text index
    - _Requirements: 37.1, 37.2, 37.3, 37.5_

  - [ ]* 16.5 Write property test for discovery filtering and ordering
    - **Property 46: Discovery surfaces only public non-terminal events matching the query**
    - **Validates: Requirements 37.1, 37.2, 37.3, 37.5**

  - [~] 16.6 Implement legal acceptance, disclaimers, and mainnet/KYC gating
    - Block create/fund actions unless the acting user has a current-version acceptance of Terms and Custody Disclosure; require re-acceptance after document updates; render the Platform-Admin-configurable jurisdiction/eligibility disclaimer during signup; block mainnet operations unless enabled per environment; require identity verification at or above the configured threshold; testnet requires no KYC
    - _Requirements: 34.1, 34.2, 34.3, 34.4, 34.5_

  - [ ]* 16.7 Write property test for current legal acceptance gating
    - **Property 48: Financial actions require current legal acceptance**
    - **Validates: Requirements 34.1, 34.5**

  - [ ]* 16.8 Write property test for mainnet and KYC gating
    - **Property 49: Mainnet and KYC gating hold per network mode**
    - **Validates: Requirements 34.3, 34.4**

  - [~] 16.9 Implement account deactivation, deletion, and data export
    - Support account deactivation (disable login, hide profile) preserving financial/audit records; block deletion while the user has active financial obligations; anonymize deletable personal fields within the retention window while retaining immutable compliance data (audit records, transaction records, disbursement-tied wallet addresses); provide a GDPR-style machine-readable export of deletable personal data
    - _Requirements: 35.1, 35.2, 35.3, 35.4, 35.5_

  - [ ]* 16.10 Write property test for deletion obligations and classification
    - **Property 50: Account deletion respects obligations and data classification**
    - **Validates: Requirements 35.1, 35.2, 35.3, 35.4**

  - [~] 16.11 Implement public content reporting and moderation review
    - Provide a reporting endpoint allowing any authenticated user to flag public event content (description, banner, sponsor logos); on flag, create an audit record and surface the report for Platform Admin review with dismiss/warn/unpublish actions
    - _Requirements: 36.2, 36.5_

  - [ ]* 16.12 Write unit tests for content reporting and moderation actions
    - Test that flagging creates an audit record and that dismiss/warn/unpublish actions apply correctly under the permission matrix
    - _Requirements: 36.2, 36.5_

- [ ] 17. Extensibility: public API, webhooks, plugins, feature flags
  - [~] 17.1 Implement the versioned public API, webhooks, plugins, and feature flags
    - Namespace the public API under `/api/v1/**` with API-key auth and per-key usage tracking, returning plain JSON responses consumable by any HTTP client (web, mobile, CLI) with no browser-specific dependencies; implement HMAC-SHA256 webhook payload signing for registered callbacks; define the Plugin lifecycle-hook interface, including extension points for AI-assisted features (submission analysis, judging assistance, event analytics) and for enterprise authentication (SAML 2.0, OIDC, API-based SSO) configurable per workspace with fallback to standard Supabase Auth; gate capabilities per workspace via feature flags; enforce a backward-compatible API versioning policy where new versions add fields/endpoints without removing existing ones, and deprecated fields are marked with sunset dates and remain functional for a minimum of 6 months
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 32.8, 32.9, 32.10_

  - [ ]* 17.2 Write property test for webhook payload signing
    - **Property 51: Webhook payload signing round-trip**
    - **Validates: Requirements 32.3**

  - [ ]* 17.3 Write property test for feature-flag gating
    - **Property 52: Feature flags gate capabilities per workspace**
    - **Validates: Requirements 32.10**

- [ ] 18. Split paginated API endpoints
  - [~] 18.1 Implement cursor-based pagination and split event sub-resources
    - Implement cursor pagination (default 20, max 50) with the `{ data, meta: { cursor, hasMore, total } }` envelope on all list endpoints; split the god `GET /api/events/:id` into focused sub-resources (`/members`, `/submissions`, `/evaluations`, `/teams`, `/transactions`, `/winners`, `/sponsors`, `/milestones`) each independently authorized per the permission matrix; add Zod-validated filter/sort params
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 18.2 Write property test for cursor pagination coverage
    - **Property 28: Cursor pagination covers every item exactly once within bounds**
    - **Validates: Requirements 12.1, 37.4**

  - [~] 18.3 Wire financial and state-transition route handlers
    - Wire `/events/[id]/fund`, `/disburse`, `/refund` (idempotency-wrapped), the state-transition endpoint returning the complete 422 payload, and the dispute lifecycle endpoints, composing authenticate → authorize → validate → handle
    - _Requirements: 6.4, 23.4, 23.5, 4.9, 8.3, 9.1_

  - [ ]* 18.4 Write property test for complete 422 transition payload
    - **Property 2: Invalid transitions return a complete 422 payload**
    - **Validates: Requirements 6.4, 23.5**

  - [ ]* 18.5 Write property test for role-gated outbound transitions
    - **Property 3: Outbound transitions are role-gated**
    - **Validates: Requirements 23.4**

  - [~] 18.6 Implement health and readiness endpoints
    - Implement `GET /api/health` (200 unauthenticated) and `GET /api/health/ready` (200 when DB active, 503 when unavailable); return 503 with a structured error on core Postgres unavailability
    - _Requirements: 2.6, 20.3, 20.4_

- [~] 19. Checkpoint - API surface
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Frontend: dashboards, wallet UI, and shared UI states
  - [~] 20.1 Implement shared UI: data tables, loading/empty/error states, and accessibility
    - Build reusable data tables that collapse to cards on mobile; loading, empty, and error states with `aria-live` announcements; responsive layouts and WCAG AA affordances (ARIA labels, focus management, keyboard navigation, contrast)
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

  - [~] 20.2 Implement the wallet UI, onboarding, and connection-state flow
    - Build wallet connect/verify UI with the connection-state machine (Disconnected→Connecting→Connected→Verified→Error), a Freighter-detection install prompt, a skippable first-time guided onboarding flow, silent session persistence with automatic reconnection, extension-loss detection within 5s with a non-blocking reconnect prompt, a guided wallet-switching flow, a pre-signing confirmation dialog (type, amount, source, destination, network, fees), a multi-stage transaction progress indicator, network-mismatch warnings, transaction-failure recovery actions preserving entered details, verification-status badges wherever the address is shown, user-friendly action labels, per-user transaction history with explorer links, approximate fiat values from the price oracle, and an on-load wallet health check
    - _Requirements: 25.3, 25.6, 25.7, 25.8, 25.11, 33.1, 33.3, 33.4, 33.5, 33.6, 33.7, 33.8, 33.9, 33.10, 33.11, 33.12, 33.13, 33.14, 33.16_

  - [~] 20.3 Implement role-specific dashboards
    - Build the Platform Admin, Workspace, Organizer, Judge, Sponsor, and Participant dashboards as Server Components with role-appropriate KPIs and quick actions, aggregating across roles with clear role-context labels
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7, 29.8_

  - [~] 20.4 Implement sponsor and milestone management UI and public event page
    - Build sponsor CRUD (name, logo, tier) with tier-grouped public display; milestone CRUD with chronological display and past/current/upcoming indicators; milestone-passed notifications; the public event detail page with the trust checklist and escrow verification
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

  - [ ]* 20.5 Write component and accessibility tests for frontend
    - Add axe-core checks for ARIA/contrast/focus, wallet connection-state transition tests, network-mismatch warning tests, and responsive card-collapse snapshots
    - _Requirements: 22.1, 22.2, 33.4, 33.8_

- [ ] 21. Integration, configuration, and smoke tests
  - [ ]* 21.1 Write integration tests for external-service and cross-layer behavior
    - Realtime delivery within 5s with polling fallback; malware-scan rejection (mocked); end-to-end escrow happy path (fund → lock → review → disburse → complete) against testnet in the staging suite
    - _Requirements: 2.5, 2.8, 16.4, 28.2, 36.1_

  - [ ]* 21.2 Write configuration and smoke checks
    - TS strict compile with no `any`; single deployable artifact; CSP/HSTS/CORS in production; secrets absent from client bundles and version control, managed through a secrets manager (not committed config files) with rotation supported without downtime; only `@stellar/stellar-sdk` v16+ present with Firebase/Gmail OAuth removed; verify all database operations use parameterized queries exclusively with no string-interpolated SQL; run a coverage report and verify a minimum of 80% test coverage on `/lib/services` and `/lib/state-machine` business logic; confirm documented Supabase Postgres DR targets (RPO 15 minutes, RTO 4 hours) and a periodic restore-drill procedure exist; verify development, staging, and production environments are isolated with no shared secrets or datastores; CI gates (type-check, lint, test, migration dry-run) on main
    - _Requirements: 1.7, 14.1, 14.4, 14.5, 14.6, 14.9, 17.1, 17.2, 17.3, 17.4, 17.5, 17.7, 38.1, 38.2, 38.3, 38.4, 38.5_

- [~] 22. Final checkpoint - full suite green
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each of the 53 correctness properties from the design has exactly one dedicated property test sub-task, tagged `// Feature: nextjs-platform-conversion, Property N: ...` and run with fast-check at a minimum of 100 iterations.
- Property tests are placed adjacent to the implementation they validate so correctness errors surface early.
- Stellar Horizon and KMS are mocked in property tests for deterministic 100+ iteration runs; signature verification (Property 5) uses the real SDK.
- Infrastructure/config criteria (Supabase wiring, RLS deployment, headers, secrets, dependency removal, WCAG) are covered by integration/smoke/example tests rather than properties.
- Content moderation/reporting (Req 36.2, 36.5), account data export (Req 35.5), the jurisdiction disclaimer (Req 34.2), and the wallet UX/onboarding flows (Req 33) are validated by example/unit/component and integration tests rather than dedicated correctness properties, matching the design's Correctness Properties scope.
- Checkpoints ensure incremental validation at foundation, financial core, API surface, and final stages.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1", "3.2", "4.1", "4.4", "4.6", "5.1", "5.4"] },
    { "id": 4, "tasks": ["3.3", "3.5", "4.2", "4.3", "4.5", "5.2", "5.3", "5.5", "6.1", "6.4", "7.1", "8.1"] },
    { "id": 5, "tasks": ["3.4", "3.6", "6.2", "6.3", "6.5", "7.2", "8.2", "9.1", "9.4", "11.1", "11.4"] },
    { "id": 6, "tasks": ["7.3", "7.4", "7.5", "9.2", "9.3", "9.5", "11.2", "11.3", "11.5", "11.6", "12.1", "12.7"] },
    { "id": 7, "tasks": ["12.2", "12.3", "12.4", "12.5", "12.8", "12.9", "12.12", "14.1"] },
    { "id": 8, "tasks": ["12.6", "12.10", "12.11", "12.13", "12.14", "14.2", "14.3", "14.4", "14.5"] },
    { "id": 9, "tasks": ["14.6", "14.7", "15.1", "15.4", "15.7", "15.11", "16.1", "16.4", "16.6", "16.9", "16.11", "17.1"] },
    { "id": 10, "tasks": ["15.2", "15.3", "15.5", "15.6", "15.8", "15.9", "15.10", "15.12", "16.2", "16.3", "16.5", "16.7", "16.8", "16.10", "16.12", "17.2", "17.3"] },
    { "id": 11, "tasks": ["18.1", "18.3", "18.6"] },
    { "id": 12, "tasks": ["18.2", "18.4", "18.5", "20.1", "20.2", "20.3", "20.4"] },
    { "id": 13, "tasks": ["20.5", "21.1", "21.2"] }
  ]
}
```
