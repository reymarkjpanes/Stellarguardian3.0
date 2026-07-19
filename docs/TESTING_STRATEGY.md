# Testing Strategy

Stellar Guardian 3.0 adopts a formalized Testing Pyramid to ensure robust data integrity, authorization enforcement, and workflow correctness before code is merged.

## 1. Unit Tests
- **Scope:** Core domain models, application services, state machine transition logic, and validation schemas (Zod).
- **Tools:** Vitest.
- **Focus:** Fast, isolated testing of business invariants. Mocking is permitted for external dependencies (e.g., database, email).
- **Coverage Goal:** 90%+ on `lib/domain` and `lib/state-machine`.

## 2. Property-Based Testing
- **Scope:** State Machine and Event Lifecycle.
- **Tools:** `fast-check` alongside Vitest.
- **Focus:** Ensuring that no sequence of valid state transitions can lead to an invalid terminal state (e.g., distributing funds before winners are finalized).

## 3. Integration Tests
- **Scope:** API Routes (`/api/*`), Database repositories, and Authorization middleware.
- **Tools:** Vitest, Supabase Local instance.
- **Focus:** Validating that the complete backend mutation pipeline (Auth → Validation → Domain → DB Transaction) functions correctly. Real database instances are used; no database mocking.
- **Security Testing:** Every endpoint must include tests verifying rejection (`403 Forbidden`) when accessed with insufficient roles.

## 4. Contract Tests
- **Scope:** Frontend-to-Backend data boundaries.
- **Focus:** Ensuring the frontend `fetch` calls and expected responses perfectly map to the API's Zod schemas, preventing regressions if API structures change.

## 5. End-to-End (E2E) Tests
- **Scope:** Critical user journeys and lifecycle workflows.
- **Tools:** Playwright.
- **Focus:** Automating browser interactions to verify the "Happy Path" for primary workflows.
- **Core Lifecycle Test:** Organizer creates event → Organizer funds escrow → Participant registers → Participant submits → Judge scores → Organizer finalizes winners → Escrow releases funds.

## 6. Performance & Load Testing
- **Scope:** High-concurrency endpoints (e.g., Event Registration, Submission Uploads).
- **Tools:** k6 or Artillery.
- **Focus:** Verifying the platform handles sudden spikes (e.g., a hackathon registration opening or submission deadline) without database lockups or degraded API latencies.

## 7. Security Testing
- **Scope:** Common OWASP vulnerabilities and authorization matrices.
- **Focus:** 
  - Cross-Site Scripting (XSS) prevention via CSP nonce checks.
  - Insecure Direct Object Reference (IDOR) prevention (testing APIs with mismatched user IDs).
  - Rate limiting verification (brute force testing).
