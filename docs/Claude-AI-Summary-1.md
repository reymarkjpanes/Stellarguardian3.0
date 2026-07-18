Executive Summary
The product has real bones — layered auth, Zod validation, Kysely migrations, a genuine Stellar Testnet integration, decent test coverage on the backend. But the "trust layer for prize money" pitch is currently undermined by its own implementation: escrow funding is platform-funded, not organizer-funded; wallet "connection" has zero cryptographic proof of ownership (and is literally mocked in the UI); a Firestore rule leaves email templates world-writable; and there are two parallel, contradictory implementations of funding, payout, auth, and the event state machine. None of this is exotic to fix, but it means the core value proposition — verifiable, non-custodial-feeling escrow — doesn't hold up yet.
Readiness Scores
DimensionScore /100WhyProduct Readiness35Core loop demoable end-to-end; funding trust story is brokenEngineering Readiness40Modular layer exists but coexists with an untouched legacy monolithArchitecture45Good instincts (schemas/services/middleware split), undermined by duplication and a fragile Firestore-sync hackUX40Polished wizard/toasts, but missing confirmations on irreversible money actions, broken team-join flowSecurity25Open Firestore rule, no wallet-ownership proof, single symmetric key custodies all escrow fundsScalability30No pagination on core lists, one "god endpoint," naive full-table Firestore replicationMaintainability35Dual auth/state-machine/funding implementations, committed one-off codemod scripts, dead codeCross-Reality ConsistencyLowCode contradicts itself in at least 4 places (funding, payout, auth, state machine)
Findings by Severity
Critical

Escrow is platform-funded, not organizer-funded. fundEventEscrow() sources the on-chain payment from the platform's own STELLAR_ESCROW_SECRET keypair and merely records the host's wallet address as metadata (fromWallet: host.walletAddress) on the transaction row. The organizer's connected wallet never signs or sends anything. The "Verified Escrow" badge is factually misleading. Impact: fund-safety and trust-integrity failure at the core of the product. Priority: Critical.
Two competing funding/payout code paths exist simultaneously. server.ts has a mock /api/events/:id/fund (fake txRef, no chain interaction) and server/routes/stellar.ts has a real /api/stellar/fund-event. Same duplication for payout. Both are wired to live UI buttons (EventDetail.tsx "Mock Fund Event" vs EscrowManager.tsx "Fund to Escrow"). A host can end up with an event marked Funded/Completed with no real money ever moved. Priority: Critical.
Wallet "connection" has no proof of ownership. POST /auth/wallet/connect accepts any regex-valid G-address with zero signature challenge; the frontend (Settings.tsx) literally simulates it with a random address generator behind a "Mock Mode" banner. Anyone can claim any address, including a real winner's, redirecting payouts. Priority: Critical.
firestore.rules allows allow read, write: if true on email_templates. Unauthenticated, unrestricted read/write/delete on that collection from anywhere via the Firestore REST API, independent of the app's own auth. Priority: Critical — actively exploitable today.
No refund path for cancelled-but-funded events. POST /events/:id/cancel just flips state to Cancelled; the escrow keypair/secret are left orphaned with no on-chain return-to-host flow. Real funds can become stranded. Priority: Critical.
Winner prize allocation isn't validated against escrow balance. SetWinnersSchema bounds each prizeAmount individually but never checks Σ prizeAmount ≤ escrow balance / prizeTotal. Overallocation only fails at disbursement time, per-winner, with no atomic reservation or pre-flight check.

High

Dual event-state-machine implementations (server.ts VALID_TRANSITIONS vs src/lib/eventStatus.ts) with no shared source of truth — a change to one silently doesn't propagate to the other.
Dual auth middlewares (authenticateToken legacy vs authenticate modern) still both live; ~30 legacy routes use flat {error: "string"} shapes while modular routes use {error:{code,message}}.
Authorization checks copy-pasted ~15+ times (if (event.hostUserId !== req.user.id)...) instead of using the already-written requireHost middleware.
No dispute/objection window before finalizing winners — one click on "Complete Event & Set Winners" is irreversible and immediately unlocks real disbursement, with no confirmation dialog and no participant-facing contest mechanism anywhere in the product.
Team workflow is broken: TeamsTab.tsx's hasTeam check is hardcoded false with a comment admitting it's a stopgap; there's no "join existing team" UI at all, and teamSizeMax is never enforced server-side.
GET /api/events/:id is a god endpoint — ~15 inline queries covering 10 different bounded contexts (members, teams, submissions, evaluations, winners, transactions, etc.), unpaginated, returned as one payload regardless of which tab is open.
No pagination on /api/events or /api/events/public — unbounded arrays at scale.
CSP allows 'unsafe-inline' for scripts and styles unconditionally, not branched by NODE_ENV, so the "Vite dev only" relaxation ships to production.
Judge conflict-of-interest check only blocks scoring your own submission, not a teammate's, despite the role model allowing a user to hold both Judge and Participant memberships on the same event.
Firestore "backup" layer is not real replication: a debounced full-table dump to a single Firestore document (1MB doc limit) on every write, via a monkey-patched db.prepare, with no conflict resolution across instances — breaks under any multi-instance deployment or moderate data volume.

Medium

Dead/incomplete features left in the codebase: submissions.isDraft column defined but unused; a client-side Gmail-send OAuth integration (googleAuth.ts) with no visible caller and no token-refresh handling.
No idempotency keys on fund/payout endpoints beyond ad hoc state checks — retry-prone on flaky connections.
No optimistic-concurrency protection on event edits (PUT /api/events/:id) — silent last-write-wins.
Inconsistent error handling on the frontend: silent catch {} blocks (Notifications.tsx), and ForgotPassword.tsx shows "email sent" success messaging even when the request itself throws.
Sponsors/milestones have backend CRUD endpoints with no corresponding management UI evident in the provided files — a backend capability with no front door.
One-off codemod scripts (update_*.cjs, fix_*.cjs, fix_ui.py, run_migrations.cjs, test.js) committed at repo root — maintainability/security smell, one even contains a comment admitting its own regex replace might be wrong.

Low

Accessibility is inconsistent — strong on Notifications/ForgotPassword/ResetPassword, nearly absent on EventWizard/AdminTab/JudgingTab (icon-only buttons without aria-label, no aria-live on toast-driven state changes).
Data-dense admin tables (members/invitations) rely solely on overflow-x-auto for mobile — no responsive card fallback.
sync.ts builds SELECT ${columns} FROM ${table} from a fixed allowlist — not currently exploitable, but a fragile pattern worth hardening.

Recommended Direction (grouped)

Trust model first: decide and implement one real answer for "who signs the funding transaction" — either true non-custodial (organizer's wallet signs directly, platform never touches keys) or an explicitly-documented custodial model with compensating controls (multisig, HSM/KMS-backed key custody, or a real escrow-as-a-service integration). Whatever you pick, kill the platform-funds-everything pattern.
Collapse duplication: one funding path, one payout path, one state machine (shared TS module imported by both server and client build, or exposed via an API the client reads), one auth middleware, one authorization helper.
Real wallet proof-of-ownership via a signed-challenge flow before "connect wallet" is accepted.
Lock down Firestore rules immediately; treat this as a live incident, not a backlog item.
Add the missing financial-safety workflows: refund-on-cancel, pre-flight prize-allocation validation, an objection/dispute window before finalizing winners.
Split the god endpoint, add pagination everywhere lists are unbounded.
Replace the Firestore-hack persistence layer with a real managed relational database and proper replication once you're past prototype scale.
Delete the dead scripts and dead code, finish or remove the half-wired Gmail integration.