# Stellar Guardian 3.0 Architecture

## 1. System Overview
Stellar Guardian 3.0 is a trustless event and hackathon management platform backed by Stellar blockchain escrow. It allows organizers to manage events, participants to form teams and submit projects, and judges to evaluate submissions. Prize pools are securely locked in Stellar escrow accounts and distributed on-chain automatically upon winner selection.

## 2. Context Diagram
The system interacts with the following external actors and systems:
- **Actors:** Organizers, Participants, Judges, Platform Admins.
- **External Systems:**
  - **Stellar Horizon/Network:** For escrow funding and prize disbursement.
  - **Supabase:** Database, Authentication, and Realtime subscriptions.
  - **Freighter Wallet:** Client-side wallet for transaction signing.
  - **AWS KMS:** Production key management for escrow automation.
  - **Resend:** Transactional emails (invites, notifications).

## 3. High-Level Architecture
The platform is built as a monolithic full-stack application using Next.js (App Router), leveraging serverless functions for API endpoints and Supabase for state management.
- **Frontend:** React 19 server and client components, styled with Tailwind CSS.
- **Backend:** Next.js Route Handlers (`/api/*`).
- **Database:** PostgreSQL (via Supabase) with Row-Level Security (RLS).
- **Blockchain:** Stellar SDK.

## 4. Layered Architecture
To ensure business logic is isolated and maintainable, the backend follows a strict layered architecture:
1. **Transport Layer (Next.js API Routes):** Handles HTTP parsing, authentication, and structured responses.
2. **Application Service Layer:** Orchestrates domain aggregates and coordinates transactions (e.g., `EventService`, `EscrowService`).
3. **Domain Layer:** Encapsulates core business rules, aggregates, and state machine validation. Independent of the database.
4. **Repository Layer:** Abstracted data access, handling Supabase/PostgreSQL queries and translating them into Domain models.

## 5. Domain Architecture (Bounded Contexts)
- **Event Context:** Manages hackathon lifecycles (Draft → Judging → Complete), rules, and milestones.
- **Team Context:** Manages participant groupings, join requests, and team capacities.
- **Evaluation Context:** Manages submissions, scoring rubrics, and judge assignments.
- **Escrow & Financial Context:** Manages on-chain prize pools, transaction signing, and winner disbursements.

## 6. Data Flow (Mutation Pipeline)
All state-mutating requests strictly follow this pipeline to prevent bypasses:
1. `Browser` sends POST/PATCH.
2. `Next.js API` validates Authentication (Session).
3. `Authorization Middleware` validates Workspace Role & Permissions.
4. `Zod` validates the payload structure.
5. `Application Service` executes Business Rules.
6. `Repository` executes a Database Transaction.
7. `Audit Service` logs the mutation.
8. `Event Bus` publishes a Domain Event for side effects.
9. `Response` returned to client.

## 7. Authentication Flow
- Handled via Supabase Auth (SSR Cookie-based).
- Users authenticate via Email/Password or OAuth.
- For financial actions, a secondary **Wallet Challenge-Response Flow** is required using Freighter to verify the user controls the destination Stellar address.

## 8. Authorization Flow
- Implemented via a **Permission Matrix**.
- Users belong to Workspaces and possess Roles (Organizer, Judge, Participant).
- Before any business logic executes, the backend verifies `(User, Role, Resource, Action)` against the central matrix.
- Supabase Row-Level Security (RLS) provides a defense-in-depth safety net.

## 9. Event Flow (Side Effects)
- Implemented using an Event-Driven Architecture (EDA).
- When a transaction commits (e.g., `SubmissionCreated`), a Domain Event is published to a local event bus or background queue.
- Independent handlers process notifications, webhooks, and cache invalidation asynchronously.

## 10. Deployment Architecture
- **Web App:** Deployed on Vercel (Edge Network and Serverless Functions).
- **Database:** Supabase managed PostgreSQL instance.
- **Key Management:** AWS KMS (for programmatic transaction signing when distributing prizes).
- **Cron Jobs:** Scheduled invocations via Vercel Cron or GitHub Actions hitting `/api/cron`.

## 11. Technology Decisions
See the Architecture Decision Records (`docs/adr/`) for detailed rationale on critical technical choices, including:
- API-First Mutations (ADR-002)
- Transaction Boundaries (ADR-004)
- Event-Driven Architecture (ADR-006)
