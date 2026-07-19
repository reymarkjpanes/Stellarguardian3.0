# Threat Model

This document outlines the security threats, trust boundaries, and mitigation strategies for the Stellar Guardian 3.0 platform, using the STRIDE methodology.

## 1. Trust Boundaries
- **Browser/Client:** Untrusted. Data originating here is assumed malicious.
- **Next.js Edge/Server:** Trusted boundary. Executes validation and authorization.
- **Supabase PostgreSQL:** Trusted boundary. Data at rest. RLS acts as a secondary defense layer.
- **Stellar Horizon / Freighter:** External trust boundaries. Freighter is trusted to hold user keys; Horizon is trusted for ledger state.
- **AWS KMS:** Highly trusted. Holds the application's escrow operational keys.

## 2. Assets & Attack Surface
- **Assets:** User PII, Escrow Private Keys, Prize Pool Funds, Evaluation Scores.
- **Attack Surface:** Next.js API Routes, Supabase Realtime Channels, Client-side Forms, Webhook Endpoints.

## 3. STRIDE Analysis

### Spoofing (Identity)
- **Threat:** An attacker impersonates an Organizer to modify an event or access funds.
- **Mitigation:** Supabase Auth (JWTs). All sensitive routes require valid session extraction. Financial actions require secondary cryptographic proof (signing a challenge with the Freighter wallet).

### Tampering (Integrity)
- **Threat:** A participant modifies their submission after the deadline or changes evaluation scores.
- **Mitigation:** API-First mutations. The backend state machine prevents submissions after the `SubmissionClosed` state. Database RLS prevents unauthorized updates.

### Repudiation (Auditability)
- **Threat:** A Judge denies submitting an evaluation, or an Organizer denies cancelling an event.
- **Mitigation:** Every state mutation generates an immutable Audit Log (Who, When, Old Value, New Value, IP) in an append-only database table.

### Information Disclosure (Confidentiality)
- **Threat:** Unreleased evaluation scores or private event details leak to participants.
- **Mitigation:** Next.js API authorization pipelines verify user roles before querying data. Supabase RLS policies restrict `SELECT` access based on workspace membership. Escrow keys in KMS never leave the AWS boundary.

### Denial of Service (Availability)
- **Threat:** Automated bot rapidly submits registrations, exhausting database connections or filling storage.
- **Mitigation:** Upstash Redis rate-limiting applied per IP and per User on API routes (e.g., 100/min). Supabase connection pooling handles database scale.

### Elevation of Privilege (Authorization)
- **Threat:** A Participant accesses the `/admin` dashboard or calls the `POST /api/events/[id]/winners` endpoint to declare themselves the winner.
- **Mitigation:** Centralized Authorization Matrix. The API endpoint extracts the user's role and strictly enforces that only `PlatformAdmin` or `Organizer` can access privileged resources. Insecure Direct Object Reference (IDOR) is prevented by checking ownership on every request.

## 4. Specific Platform Risks
- **Client-Side Database Mutations:** The primary architectural flaw in V2. Refactored in Phase 1 so no client can bypass the backend API.
- **Race Conditions:** Resolved via Optimistic Concurrency Control (`version` column) and Idempotency Keys on all mutable state endpoints.
- **Cross-Site Scripting (XSS):** Mitigated via dynamic `nonce` integration in the Content Security Policy (CSP), preventing inline script execution.
