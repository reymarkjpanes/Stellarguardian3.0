# Stellar Guardian 3.0 — Comprehensive Product Discovery, System Audit & Gap Analysis

**Date:** July 19, 2026  
**Auditor:** Senior Product & Engineering Architecture Team  
**Scope:** Full-stack assessment of the Next.js 16 + Supabase + Stellar platform.  

---

## 1. Executive Summary

Stellar Guardian 3.0 is a trustless event and hackathon management platform backed by Stellar blockchain escrow. The platform aims to empower organizers to host events, manage teams, evaluate submissions, and distribute prize pools on-chain transparently.

**Current State:** The platform has a strong foundation with a Next.js App Router and Supabase PostgreSQL architecture. The database schema, state machine, and Role-Level Security (RLS) policies are exceptionally well-designed (representing ~85% completeness at the infrastructure layer). However, the **product wiring, UX layer, and architectural enforcement are severely lacking** (~60% completeness).

**The most critical systemic failure** is that multiple key frontend forms bypass the internal API layer entirely, writing directly to the database via the Supabase client. This circumvents business logic, audit trails, state machine preconditions, and permission matrices. 

Furthermore, the system lacks several enterprise-grade architecture patterns, including formalized transaction boundaries, event-driven side effects, and centralized API validation pipelines.

---

## 2. Product Discovery Findings

The platform's business model relies on absolute trust in its escrow and prize distribution mechanics. However, current product discovery reveals that it fails to onboard users and guide them through success paths effectively.

**Missing Product Capabilities:**
- **No Value Proposition / Landing Page:** Unauthenticated users are met with a redirect to `/login`.
- **Sponsor Onboarding:** No self-service flow for sponsors to join an event and pledge funds.
- **Winner Claim Flow:** Winners are selected, but there is no dedicated "You Won! Claim your prize" experience.
- **Password Recovery & Email Callback:** Next.js application is missing reset flows and confirmation callbacks.

---

## 3. UX & UI Audit Report

- **Information Architecture:** Deep pages lack breadcrumbs. Desktop navigation orphans several key routes.
- **Confirmation Flows:** Destructive actions lack progressive disclosure.
- **Feedback & Progressive Disclosure:** Mutations lack optimistic UI updates. Forms are overwhelming.
- **Design System Inconsistency:** Auth pages use hardcoded Tailwind, while the app uses CSS custom properties.
- **Mobile & Usability:** Missing required field indicators, no draft persistence, and tabs overflow on mobile.

---

## 4. Workflow & User Journey Analysis

- **Event Lifecycle Workflow:** Transitions bypass the backend `canTransition()` logic, allowing illegal state changes.
- **Team Formation Workflow:** No "Join Request" flow or "Invite" flow.
- **Judging & Dispute:** Missing judge assignment UI, configurable rubrics, and dispute resolution workflows.
- **Escrow Workflow:** The "Fund Escrow" button triggers a raw `alert()` instead of Freighter wallet signing.
- **First-Time Visitors & Winners:** Immediate redirect loops and zero guidance for unverified winners.

---

## 5. Domain Model & Database Gap Analysis

The database schema is highly normalized but lacks proper Domain Modeling enforcement:

- **Missing Domain Layer:** Currently, logic flows directly from `API → Service → Repository`. To properly encapsulate complex rules, the system requires a structured Domain layer:
  `API → Application Service → Domain (Aggregates) → Repository`.
- **Aggregates Needed:** Event, Team, Escrow, Submission, and Winner. This keeps business rules independent of APIs or database implementations.
- **Missing Entities:** `webhook_endpoints`, `user_preferences`, `event_rubrics`, `team_join_requests`.

---

## 6. Architecture Guardrails & API Gap Analysis

To ensure regressions do not occur as the team scales, strict **Architecture Guardrails** must be defined:
- UI never writes directly to the database.
- Only API routes can mutate state.
- Services cannot import UI code.
- Repositories contain no business logic.
- Database triggers never replace business rules.
- Every mutation generates an audit event.
- Every API endpoint requires validation and authorization.

**API Deficiencies:**
- **Contract Violations:** Direct frontend DB writes.
- **Missing API Validation Standard:** Zod Validation must precede Business Rules and DB operations.
- **Transaction Boundaries:** Event creation and escrow workflows lack DB transactional safety (`BEGIN/COMMIT`).
- **Idempotency & Concurrency:** Optimistic Concurrency Control (version checking) and Idempotency keys are missing for non-financial operations.
- **Centralized Error Handling:** Missing standard AppError classes.

---

## 7. Event-Driven Architecture & Feature Gaps

- **Side Effects:** Audits, notifications, and webhooks run synchronously. The system should publish Domain Events (e.g., `EventCreated`) that independent handlers subscribe to.
- **Feature Gaps:** Missing Activity Timelines, Comments, File Attachments, Bulk Actions, Export/Import, and Workspace Search.
- **Background Jobs & Feature Flags:** Missing infrastructure for asynchronous processing and safe deployments.

---

## 8. Security & Authorization Matrix Review

- **CRITICAL: Authorization Bypass via Client Mutations:** Bypassing the API circumvents RLS and business logic.
- **Authorization Matrix:** The system lacks a centralized pipeline that checks `Workspace Membership → Role → Permission` before executing logic.
- **Static CSP Nonce:** `middleware.ts` uses a hardcoded literal string.

---

## 9. Testing Strategy (Testing Pyramid)

The current testing relies heavily on property-based tests but lacks a formalized testing pyramid:
1. **Unit Tests:** Core domain rules, services, validation.
2. **Integration Tests:** API endpoints, database transactions, auth flows.
3. **Contract Tests:** Frontend-to-Backend API boundaries.
4. **End-to-End Tests (Playwright):** Lifecycle testing (Create Event → Fund → Join → Score → Winner → Release).
5. **Performance & Security Tests:** Mutation testing, authorization testing, SQLi, XSS, CSRF, IDOR, Replay attacks, Load testing for submissions.

---

## 10. Operational Readiness & Scalability

Before beta, the platform must achieve operational readiness:
- **Observability:** Structured logging, Correlation IDs, Metrics, Distributed tracing, Error monitoring (Sentry), Health checks, and Audit dashboards.
- **Performance Budget:** Define targets for First Contentful Paint, API response times, and DB query counts (N+1 protection).
- **Disaster Recovery:** Backup and recovery procedures must be established.
- **Rate Limiting:** Multi-tiered Redis rate limiting must replace the in-memory map.

---

## 11. Migration Strategy & Definition of Done

To safely introduce architectural changes, every Phase 1 implementation must adhere to a strict migration lifecycle:

**Migration Strategy Template:**
1. Build the new API endpoint/service.
2. Feature flag the new path.
3. Switch the frontend.
4. Monitor logs & Observability.
5. Verify audit logs are generated.
6. Remove legacy client mutation code.

**Definition of Done (DoD):**
A task (e.g., Removing Client-Side DB writes) is only complete when:
- No UI component imports the Supabase browser client for writes.
- All mutations pass through API routes.
- Audit logs are created automatically.
- Permission checks execute.
- Tests (Unit/E2E) pass.
- Legacy mutation code is removed.

---

## 12. Implementation Roadmap

### Phase 0 — Architecture Lock
Deliverables: ADR review, Permission matrix, State machine diagrams, Domain model, Sequence diagrams, Database ERD validation, API contract review, Threat model, Migration plans, Definition of Done.

### Phase 1 – Platform Integrity & Security Foundation
1. Remove Client-Side Database Mutations
2. Implement Authorization Layer
3. Secure Admin Panel
4. Password Reset + Email Verification
5. Fix CSP Nonce
6. Rate Limiting (Multi-tiered)
7. KMS Integration
8. Testing & Observability Foundations
