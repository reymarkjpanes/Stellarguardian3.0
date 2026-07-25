<div align="center">

# Stellar Guardian 3.0

**Decentralized Hackathon, Bounty & Event Management on the Stellar Network**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Stellar](https://img.shields.io/badge/Stellar-SDK%2016%20·%20Soroban-141414?logo=stellar&logoColor=white)](https://stellar.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

Stellar Guardian 3.0 is a full-stack platform for running hackathons, competitive bounties, and grant programmes with trustless prize settlement via **Soroban smart contracts** on the **Stellar blockchain**. It handles the full lifecycle — from event creation and team formation through judging and ranked disbursement — with on-chain escrow as the settlement layer.

</div>

---

## Table of Contents

- [Problem](#problem)
- [Solution](#solution)
- [Target Users](#target-users)
- [Why Stellar](#why-stellar)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Smart Contract](#smart-contract)
- [Contract Functions](#contract-functions)
- [Escrow Status Lifecycle](#escrow-status-lifecycle)
- [Contract Properties](#contract-properties)
- [Stellar Features Used](#stellar-features-used)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Running the App](#running-the-app)
- [Scripts Reference](#scripts-reference)
- [Project Structure](#project-structure)
- [Demo Video](#demo-video)
- [Demo Flow](#demo-flow)
- [Important Usage Notes](#important-usage-notes)
- [Screenshots](#screenshots)
- [Stellar Builder Challenge](#stellar-builder-challenge)
- [Security](#security)
- [License](#license)

---

## Problem

Running hackathons, bounties, and grant programmes at scale comes with a trust problem. Organisers hold prize funds on their own accounts or through centralised payment processors — participants have no on-chain guarantee that funds actually exist or will be disbursed fairly. Disputes are resolved manually, payouts can be delayed or withheld, and there is no transparent audit trail.

---

## Solution

Stellar Guardian 3.0 eliminates the trust gap by holding prize pools in a **Soroban smart contract escrow** — not on the platform's balance sheet. Funds are locked on-chain when an event is funded, and released automatically to ranked winners when judging is finalised. Every state transition — from event creation through to disbursement — is recorded on-chain and verifiable by anyone.

- Organisers can only deposit, not withdraw once funded
- Winners receive exact ranked amounts with no manual intervention
- Platform fees are transparently snapshotted at job creation time
- Disputes trigger a separate on-chain resolution state machine

---

## Target Users

| Role | What they do on the platform |
|---|---|
| **Organiser** (`Organizer`) | Creates events, sets prize pools, funds the escrow contract via Freighter, selects winners |
| **Participant** | Registers for events, submits projects, can file disputes about own submissions |
| **Team Captain** (`TeamCaptain`) | Leads a team, creates/updates the team submission, accepts join requests |
| **Judge** | Reviews and scores assigned submissions against configured rubrics |
| **Sponsor** | Contributes to prize pools via `admin_deposit`; monitors escrow and milestones |
| **Workspace Owner / Admin** | Manages the workspace, members, and invitations; can run events |
| **Platform Admin** | Full platform access — resolves disputes, manages escrow health, oversees disbursements |

---

## Why Stellar

| Need | Why Stellar delivers it |
|---|---|
| Fast settlement | Transactions finalise in 3–5 seconds — no waiting for block confirmations |
| Low fees | Nominal fees (fractions of a cent) make even micro-prize distributions viable |
| Smart contracts | Soroban provides a safe, resource-metered contract environment for escrow logic |
| Native assets | XLM as a first-class payment asset — no wrapping or bridging required |
| Wallet UX | Freighter gives users a familiar browser-extension signing experience |
| Transparency | Every contract interaction is verifiable on Stellar Expert |

---

## Features

### 16-State Event Lifecycle Engine
A pure TypeScript state machine governs every event from draft to settlement. Transitions enforce business rules at the domain layer — independent of any framework or I/O — and are validated with property-based tests via `fast-check`.

**Lifecycle states:**
`Draft` → `Published` → `RegistrationOpen` → `RegistrationClosed` → `TeamFormationLocked` → `SubmissionOpen` → `SubmissionClosed` → `JudgingRound1` → `JudgingRound2` → `WinnerVerification` → `DisputeWindow` → `PrizeApproved` → `EscrowRelease` → `Completed` → `Archived`
(plus `Cancelled` at any stage)

### Soroban Smart Contract Escrow
Prize pools are held in a Soroban contract, not on the platform's balance sheet.

| Contract Operation | Trigger |
|---|---|
| `initialize` | Platform creates escrow for an event (admin + organizer + event_id + target + token) |
| `deposit` | Organizer signs transaction via Freighter wallet — funds locked into contract |
| `admin_deposit` | Platform authorizes a sponsor deposit from any address |
| `lock` | Platform locks the escrow once fully funded — no further deposits accepted |
| `disburse` | Platform signs single-batch payout to ranked winners → transitions to Released |
| `disburse_batch` | Platform signs multi-batch payout (stays Locked until `finalize`) |
| `finalize` | Platform finalises all batches → transitions state to Released |
| `refund` | Platform returns all funds to organizer on event cancellation |

All Soroban interactions simulate before submission, assemble resource requirements, and poll for confirmation.

### Role-Based Permission Engine
Ten roles with a typed RBAC + ABAC permission matrix enforced server-side on every API route via the `authorize()` middleware.

| Role | Description |
|---|---|
| `PlatformAdmin` | Full platform access; freeze requires compliance flag |
| `WorkspaceOwner` | Owns the workspace; full event + member management |
| `WorkspaceAdmin` | Same as WorkspaceOwner minus workspace deletion |
| `Organizer` | Manages their event; editing locked after RegistrationClosed |
| `Sponsor` | Read-only access; can view own sponsorship and milestones |
| `Judge` | Reviews events/submissions; evaluates only assigned submissions |
| `Mentor` | Read-only on submissions and teams |
| `Participant` | Creates/updates own submissions; can file disputes |
| `TeamCaptain` | Manages own team; creates/updates team submission; accepts join requests |
| `TeamMember` | Can contribute to team submission; read-only on teams |

### Domain Event Bus
An in-process domain event bus decouples financial operations, audit logging, and notification delivery. Subscribers are registered at application bootstrap and process events asynchronously with `Promise.allSettled`.

### KMS Envelope Encryption
Platform signing keys are never stored in plaintext.

- **Development**: AES-256-GCM with HKDF-derived key from `LOCAL_ENCRYPTION_KEY`
- **Production**: AWS KMS envelope encryption (`kms:Encrypt` / `kms:Decrypt`)

### Typed Error Hierarchy
All API responses follow a canonical envelope schema. The error hierarchy (`AppError`, `ValidationError`, `AuthorizationError`, `NotFoundError`, `FinancialError`, `BlockchainError`) maps to specific HTTP status codes and is validated with property-based tests.

### Teams, Submissions & Judging
- Team creation, invitation links, and join request workflows
- Submission versioning with revision history
- Configurable scoring rubrics with automated leaderboard calculation
- Dispute resolution state machine

### Observability & Operations
- Structured logging via a centralised `logger` utility
- `/api/health` (liveness) and `/api/health/ready` (readiness) endpoints
- Vercel Cron jobs for idempotency key cleanup (`0 * * * *`) and escrow reconciliation (`*/15 * * * *`)
- Audit trail service logging all financial and state transition events

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Next.js App Router                 │
│  app/(auth)/   app/(app)/   app/(public)/   app/api/ │
└───────────────────────┬─────────────────────────────┘
                        │
        ┌───────────────▼──────────────┐
        │        Service Layer         │  ← lib/services/
        │  EscrowService  KMSService   │
        │  AuditService   Notification │
        └───────────────┬──────────────┘
                        │
        ┌───────────────▼──────────────┐
        │        Domain Layer          │  ← lib/state-machine/
        │  EventStateMachine           │     lib/engines/
        │  EscrowStateMachine          │     lib/domain/
        │  DisputeStateMachine         │
        │  PermissionEngine            │
        │  WorkflowEngine              │
        └───────┬──────────────┬───────┘
                │              │
   ┌────────────▼───┐   ┌──────▼──────────────┐
   │  Supabase Pg   │   │  Stellar / Soroban  │
   │  (Postgres+RLS)│   │  soroban-escrow.ts  │
   └────────────────┘   └─────────────────────┘
```

The codebase has two coexisting layers (see `ARCHITECTURE_AUDIT.md` for full details):

- **`web/lib/`** — service-oriented flat layer (primary, ~70% complete)
- **`web/src/domains/`** — DDD/hexagonal bounded contexts (emerging, Teams + Submissions + Judging fully migrated)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.10 |
| UI Library | React | 19.2.4 |
| Language | TypeScript | ^5 |
| Database | Supabase (PostgreSQL + Row Level Security) | supabase-js 2.110.7 |
| Auth | Supabase Auth with SSR cookie adapter | @supabase/ssr 0.12.3 |
| Styling | Tailwind CSS | ^4.3.3 |
| Blockchain | `@stellar/stellar-sdk` | ^16.0.1 |
| Wallet | `@stellar/freighter-api` | ^6.0.1 |
| Validation | Zod | ^4.4.3 |
| State/Data fetching | TanStack React Query | ^5.101.2 |
| Testing | Vitest + fast-check (property-based) + Playwright (E2E) | ^4.1.10 |
| Email | Resend | ^4.1.2 |
| Rate Limiting | Upstash Redis (falls back to in-memory) | ^1.38.0 |
| Encryption | AWS KMS (prod) / AES-256-GCM (dev) | @aws-sdk/client-kms ^3.1090.0 |
| Deployment | Vercel (Cron + Edge Middleware) | — |

---

## Smart Contract

The escrow logic runs on a **Soroban smart contract** written in Rust, located in `contracts/escrow/src/lib.rs`. The contract is a trustless prize escrow — funds are locked on-chain and released only by the platform admin after winners are finalised.

### Contract ID (Deployed on Stellar Testnet)

```
CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT
```

| Explorer | Link |
|---|---|
| Stellar Lab | [View on Stellar Lab](https://lab.stellar.org/smart-contracts/contract-explorer?network=testnet&contractId=CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT) |
| Stellar Expert | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT) |

---

## Contract Functions

| Function | Caller | Description |
|---|---|---|
| `initialize(admin, organizer, event_id, target, token)` | Platform (admin) | One-time setup — sets organizer, funding target, and token address |
| `deposit(from, amount)` | Organizer | Locks XLM into the contract from the organizer's wallet |
| `admin_deposit(from, amount)` | Platform (admin) | Authorises a deposit from any address (sponsor use case) |
| `lock()` | Platform (admin) | Locks the escrow once fully funded — no further deposits accepted |
| `disburse(recipients, amounts)` | Platform (admin) | Single-batch payout to winners → immediately transitions to Released |
| `disburse_batch(recipients, amounts)` | Platform (admin) | Multi-batch payout — state stays Locked until `finalize()` is called |
| `finalize()` | Platform (admin) | Marks all batches complete → transitions state to Released |
| `refund()` | Platform (admin) | Returns full balance to the stored organizer address |
| `get_balance()` | Anyone | Read-only: returns current escrow balance in stroops |
| `get_state()` | Anyone | Read-only: returns numeric state (0–5, see lifecycle below) |
| `get_target()` | Anyone | Read-only: returns the configured funding target |
| `get_disbursed_total()` | Anyone | Read-only: returns cumulative amount disbursed across all batches |
| `is_locked()` | Anyone | Read-only: returns true if escrow is in Locked state |
| `get_organizer()` | Anyone | Read-only: returns the organizer's address |
| `get_event_id()` | Anyone | Read-only: returns the event UUID bytes |

---

## Escrow Status Lifecycle

```
PendingFunding ──→ PartiallyFunded ──→ FullyFunded ──→ Locked ──→ PendingRelease ──→ Released
  (0)                  (1)                (2)           (3)           (4)               (4)

Cancelled ──→ Refunded      Failed (manual review required)
   └─ refund() returns
      funds to organizer
```

On-chain state values returned by `get_state()`:

| Value | State |
|---|---|
| 0 | PendingFunding |
| 1 | PartiallyFunded |
| 2 | FullyFunded |
| 3 | Locked |
| 4 | Released |
| 5 | Refunded |

---

## Contract Properties

| Property | Description |
|---|---|
| Conservation of funds | Balance decrements by exactly the disbursed amount on every payout |
| Partial deposits | Organizer can deposit in multiple transactions until target is reached |
| Sponsor deposits | `admin_deposit` allows additional contributions from any address |
| Authorization | Every state-changing function calls `require_auth()` on the appropriate party |
| No panics | All functions return `Result<T, ContractError>`; panics are reserved for init guards |
| On-chain events | Every state change emits a contract event (`deposit`, `sponsor`, `locked`, `batch`, `disburse`, `finalize`, `refund`) |
| TTL extension | Storage TTL is extended on every write — contract does not expire during active use |
| Fee snapshot | The platform fee rate in use is locked at `initialize` time |

---

## Stellar Features Used

| Feature | Usage |
|---|---|
| Soroban smart contracts | Full escrow lifecycle — lock funds, multi-batch disbursement, refund |
| XLM (native asset) | Prize pool denomination and payment settlement via SEP-41 token interface |
| `require_auth()` | Wallet-based authorization — organizer for deposits, admin for lock/disburse/refund |
| On-chain events | Audit trail for every state transition — deposit, lock, batch, finalize, refund |
| Persistent storage | Per-event state keyed by `DataKey` enum in contract instance storage |
| TTL extension | Instance storage TTL refreshed on every write to prevent contract expiry |

---

## Prerequisites

**For the frontend:**

- **Node.js** 20 or later
- **npm** 10 or later
- **Supabase project** — [create one free](https://supabase.com/dashboard)
- **Freighter browser extension** — required for wallet interactions ([install](https://www.freighter.app/)), set to Testnet
- **Stellar Testnet account** — fund one at the [Stellar Friendbot](https://friendbot.stellar.org)
- **Testnet XLM** — needed for gas fees on all transactions

**For the smart contract (if redeploying):**

- **Rust** (latest stable) + `wasm32v1-none` target
- **Stellar CLI** v25+
- Stellar testnet account funded via Friendbot

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/reymarkjpanes/Stellarguardian3.0.git
cd Stellarguardian3.0

# Install root dev tooling
npm install

# Install web app dependencies
cd web && npm install && cd ..
```

### 2. Configure environment

```bash
cp web/.env.example web/.env.local
```

Open `web/.env.local` and fill in the required values. See [Environment Variables](#environment-variables) below for the full reference.

### 3. Apply database migrations

**Option A — Hosted Supabase project:**

Paste the contents of `web/supabase/combined_migration.sql` into the [Supabase SQL Editor](https://supabase.com/dashboard) and run it.

**Option B — Supabase CLI (local instance):**

```bash
cd web
npx supabase start          # starts local Postgres + Studio
npx supabase db push        # applies all migrations in order
```

### 4. Start the development server

```bash
# From the repo root
npm run dev
```

App is available at **http://localhost:3000**.

---

## Environment Variables

Copy `web/.env.example` to `web/.env.local`. The minimal set required to boot the app locally:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key (subject to RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service-role key (server-only, bypasses RLS) |
| `LOCAL_ENCRYPTION_KEY` | ✅ | 32+ character random string — AES-256-GCM key for dev KMS |
| `STELLAR_NETWORK_MODE` | ✅ | `testnet` or `mainnet` |
| `STELLAR_MAINNET_ENABLED` | ✅ | Set to `true` only when targeting mainnet (guards accidental prod ops) |
| `SOROBAN_RPC_URL` | ✅ | Soroban RPC endpoint (default: `https://soroban-testnet.stellar.org`) |
| `ESCROW_CONTRACT_ID` | ✅ | Deployed Soroban escrow contract ID |
| `NEXT_PUBLIC_SITE_URL` | ✅ | App base URL (default: `http://localhost:3000`) |
| `CRON_SECRET` | ✅ | Bearer secret for Vercel Cron route authentication |
| `RESEND_API_KEY` | Optional | Transactional email — app degrades gracefully without it |
| `UPSTASH_REDIS_REST_URL` | Optional | Redis for distributed rate limiting — falls back to in-memory |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash token |
| `KMS_KEY_ARN` + `AWS_REGION` | Production | AWS KMS key ARN — replaces `LOCAL_ENCRYPTION_KEY` in prod |
| `NEXT_PUBLIC_APP_VERSION` | Optional | Displayed app version string |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | Optional | Cloudflare Turnstile CAPTCHA for auth forms |

> **Never** commit `web/.env.local` or any file containing real secrets. It is covered by `.gitignore`.

---

## Database Migrations

Migrations live in `web/supabase/migrations/` and are numbered sequentially. They are idempotent and must be applied in order.

```
20250101000001_workspaces.sql
20250101000002_users.sql
20250101000003_teams.sql
20250101000004_events.sql
...
20250101000051_financial_transactions.sql
20250101000052_restrict_financial_rls.sql
```

A combined single-file version (`combined_migration.sql`) is kept in sync for quick setup on hosted projects.

To roll back a specific migration, use the corresponding file in `web/supabase/migrations_down/`.

---

## Running the App

| Command | From | Description |
|---|---|---|
| `npm run dev` | root | Start Next.js dev server with HMR |
| `npm run build` | root | Production build |
| `npm run start` | root | Run production build locally |
| `npm run lint` | root | ESLint across all files |

All root scripts proxy to `web/` via `npm --prefix web run <script>`.

---

## Scripts Reference

Run these from inside the `web/` directory:

| Script | Description |
|---|---|
| `npm run dev` | Next.js dev server (`localhost:3000`) |
| `npm run build` | Production build with type checking |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (CI) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (single run) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with V8 coverage report |
| `npm run seed` | Run database seed script |

---

## Project Structure

```
stellar-guardian-3.0/
├── web/                              # Next.js 16 application
│   ├── app/
│   │   ├── (auth)/                   # Login, signup routes
│   │   ├── (app)/                    # Authenticated app shell
│   │   │   ├── dashboard/
│   │   │   ├── events/[id]/          # Event detail + sub-routes
│   │   │   │   ├── teams/
│   │   │   │   ├── submissions/
│   │   │   │   ├── judging/
│   │   │   │   ├── winners/
│   │   │   │   ├── disputes/
│   │   │   │   └── escrow/
│   │   │   └── settings/
│   │   ├── (public)/                 # Public discover page
│   │   ├── api/                      # Route handlers
│   │   │   ├── events/[id]/
│   │   │   ├── health/
│   │   │   ├── wallets/
│   │   │   └── cron/
│   │   └── global-error.tsx
│   ├── components/                   # Reusable React components
│   │   ├── events/
│   │   ├── layout/
│   │   └── wallet/
│   ├── lib/
│   │   ├── auth/                     # Authorization middleware
│   │   ├── domain/                   # Domain event bus
│   │   ├── engines/
│   │   │   ├── permission/           # Role-permission matrix
│   │   │   └── workflow/             # Event workflow orchestration
│   │   ├── errors/                   # Typed error hierarchy + envelope
│   │   ├── events/subscribers/       # Domain event subscribers
│   │   ├── repositories/             # Data access layer
│   │   ├── services/
│   │   │   └── escrow/               # Funding, disbursement, settlement, refund
│   │   ├── state-machine/            # Event, escrow, dispute state machines
│   │   └── stellar/                  # Soroban contract client
│   ├── src/domains/                  # DDD bounded contexts (Teams, Submissions, Judging, Prizes, Rankings)
│   ├── supabase/
│   │   ├── migrations/               # Sequential SQL migrations
│   │   ├── migrations_down/          # Rollback scripts
│   │   └── combined_migration.sql    # Single-file for hosted setup
│   ├── middleware.ts                 # Edge auth + CSP
│   └── vercel.json                   # Cron schedule
├── contracts/                        # Soroban smart contracts (Rust)
├── .agents/                          # AI agent skills and rules
├── .kiro/                            # Kiro specs and steering rules
└── package.json                      # Root script proxy
```

---

## Demo Video

### Level 1 — Video Demo

▶️ [Watch on Google Drive](https://drive.google.com/file/d/1K4lYCkc9Mw61nKVQJ3V5mIvA76o81oo2/view?usp=sharing)

---

## Demo Flow

The following steps walk through the full end-to-end flow you can reproduce locally or watch in the video above.

1. **Sign up / Log in** — Create an account and verify your email
2. **Connect Freighter wallet** — Link your Stellar Testnet wallet from the Settings page; the wallet is verified on-chain before being stored
3. **Create an event** (`Draft`) — Fill in event details, assign at least one judge, set a registration deadline, then publish
4. **Published → RegistrationOpen** — Organiser opens registration; participants join the event
5. **RegistrationClosed → TeamFormationLocked** — Organiser closes registration and locks team formation once all participants are assigned to teams
6. **SubmissionOpen → SubmissionClosed** — Participants submit projects; organiser closes the submission window
7. **JudgingRound1 / JudgingRound2** — Judges score assigned submissions against the configured rubric
8. **WinnerVerification → DisputeWindow** — Organiser confirms winners; a dispute window opens for objections
9. **PrizeApproved** — Dispute window closes with no unresolved disputes; prizes are approved for release
10. **Fund escrow** — Organiser signs a Soroban `deposit` transaction via Freighter to lock XLM on-chain
11. **EscrowRelease** — Platform locks the contract, then calls `disburse` / `disburse_batch` + `finalize`; each ranked winner receives XLM directly to their verified wallet
12. **Completed** — All disbursements confirmed on-chain; event is marked complete
13. **Verify on-chain** — Every step is verifiable on [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT)

---

## Important Usage Notes

> These notes apply when running on **Stellar Testnet**.

- **Freighter must be set to Testnet** before connecting. Submitting a Mainnet-signed transaction will be rejected by the cross-network guard.
- **Keep at least 1 XLM reserve** in your wallet at all times — Stellar requires a minimum balance for account activation.
- **Transaction timeout** — the signing window is 180 seconds. If Freighter takes longer than that, the transaction will expire and you will need to retry.
- **Testnet resets** — Stellar Testnet resets periodically. If the contract ID stops responding, the contract may need to be redeployed and `ESCROW_CONTRACT_ID` updated.
- **Soroban simulation** — all contract calls are simulated first to calculate resource fees. If simulation fails, check that the contract is still live on testnet.
- **Email (Resend)** — invitation and notification emails are optional. The app works without a Resend key; emails will silently not send.
- **Rate limiting** — API routes are rate-limited. Running load tests against a local instance without Redis will fall back to in-memory limiting.

---

## Screenshots Level 1

![Screenshot](public/level1-images/1.png)

![Screenshot](public/level1-images/2.png)

![Screenshot](public/level1-images/3.png)

![Screenshot](public/level1-images/4.png)

![Screenshot](public/level1-images/5.png)

![Screenshot](public/level1-images/6.png)

![Screenshot](public/level1-images/7.png)

![Screenshot](public/level1-images/8.png)

![Screenshot](public/level1-images/9.png)

![Screenshot](public/level1-images/10.png)

![Screenshot](public/level1-images/11.png)

![Screenshot](public/level1-images/12.png)

---

## Blockchain Integration (Production Architecture)

This section documents the complete blockchain layer as implemented. All files are in `web/lib/wallet/`, `web/lib/stellar/`, `web/lib/blockchain/`, and `web/components/blockchain/`.

### Supported Wallets

| Wallet | Provider Key | Type | Install |
|--------|-------------|------|---------|
| Freighter | `"Freighter"` | Browser extension | [freighter.app](https://www.freighter.app/) |
| xBull | `"xBull"` | Browser extension | [xbull.app](https://xbull.app/) |
| LOBSTR | `"LOBSTR"` | Browser extension + mobile | [lobstr.co](https://lobstr.co/) |
| Albedo | `"Albedo"` | Web-based popup (no install) | [albedo.link](https://albedo.link/) |
| Rabet | `"Rabet"` | Browser extension | [rabet.io](https://rabet.io/) |

**Adding a new wallet** — implement `WalletAdapter` in `web/lib/wallet/<name>.ts` and register it in `web/lib/wallet/registry.ts`:

```ts
import { MyWalletAdapter } from "./mywallet";
adapters.set("MyWallet", new MyWalletAdapter());
```

No other changes required — the registry, picker UI, and `WalletProvider` all pick it up automatically.

---

### Wallet Architecture

```
WalletProvider (React context)
  └── WalletButton (nav bar — quick connect / status)
  └── WalletMenu (picker sheet / connected details)
  └── WalletConnect (full link + challenge-response verification)

  useWallet() hook — any component accesses:
    connectionState, publicKey, network, provider, adapter
    connect(provider), disconnect(), switchWallet(), signTransaction(xdr)
```

**Session persistence** — active wallet is stored in `sessionStorage` as `stellar_guardian_wallet`. On page reload the provider reconnects silently without re-prompting the user.

**Network validation** — `WalletProvider` compares the wallet's reported network against `NEXT_PUBLIC_STELLAR_NETWORK`. A mismatch shows a warning but doesn't block signing — the server's cross-network guard (`guardCrossNetwork`) rejects any mismatched submission attempt.

---

### Wallet Ownership Verification (Challenge-Response)

When a user links a wallet via `WalletConnect`, the app proves key ownership before storing the address:

```
1. POST /api/wallets/challenge  { publicKey }
   ← { challengeId, nonce: "hex_32_bytes" }

2. wallet.signMessage(nonce)
   ← signature (base64)

3. POST /api/wallets/verify  { challengeId, signature }
   ← { publicKey, verified: true }
```

The challenge expires after **5 minutes** and is single-use. The server verifies using `Keypair.verify()` from the Stellar SDK. Both UTF-8 and raw hex message encodings are tried for cross-wallet compatibility.

> **Note**: The nav-bar `WalletButton` / `WalletMenu` quick-connect flow links wallets for immediate signing but does not issue a challenge-response. Challenge-response is enforced when linking via the **Settings → Wallets** page (`WalletConnect` component), which is required before a wallet can receive prize disbursements.

---

### Smart Contract Integration

The Soroban escrow contract is deployed at:

```
CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT  (Testnet)
```

The TypeScript client (`web/lib/stellar/soroban-escrow.ts`) exposes:

| Function | Direction | Description |
|---|---|---|
| `initializeEscrow` | Server → Contract | Create escrow for an event (admin + organizer + target + token) |
| `buildDepositTransaction` | Server → Client XDR | Return unsigned assembled XDR for organizer to sign client-side |
| `buildAdminDepositTransaction` | Server → Client XDR | Pre-signed by platform admin; user adds their signature |
| `lockEscrow` | Server → Contract | Platform locks once fully funded |
| `executeSorobanDisbursementBatch` | Server → Contract | Pay a batch of winners (state stays Locked) |
| `finalizeDisbursement` | Server → Contract | Transition to Released after all batches |
| `executeSorobanRefund` | Server → Contract | Return funds to organizer |
| `queryEscrowState` | Server → Contract (read-only) | Get balance, state, isLocked, target, disbursedTotal |
| `getContractEvents` | Server → RPC | Fetch on-chain events since a ledger (for real-time sync) |

**Simulation before submission** — every contract call simulates first via `server.simulateTransaction()`. If simulation fails, the operation is aborted before any XDR is signed. This catches invalid state, insufficient balance, and unauthorized callers before they reach the network.

**Platform source account** — read-only queries (`queryEscrowState`) use the platform escrow keypair (`STELLAR_ESCROW_SECRET`) as the simulation source. It must be funded on testnet.

---

### Transaction Lifecycle

Every blockchain action from the UI goes through `useTransaction()`:

```
idle
  → preparing          (building XDR, fetching account info)
  → simulating         (server-side simulation)
  → awaiting_signature (wallet popup open, user must approve)
  → submitting         (signed XDR sent to POST /api/stellar/submit)
  → pending_confirmation (polling Horizon/RPC for confirmation)
  → confirmed          ✓ tx hash + explorer link displayed
  → failed             ✗ user-friendly error + recovery action
```

**Usage pattern:**

```tsx
const { state, execute, reset } = useTransaction();

const handleFund = () => execute(async (update) => {
  update("preparing");
  const { xdr } = await fetchBuildDepositXdr(amount);

  update("awaiting_signature");
  const signed = await signTransaction(xdr); // from useWallet()

  update("submitting");
  const { hash } = await submitSignedTx(signed);

  update("pending_confirmation", { txHash: hash });
  return {
    txHash: hash,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${hash}`,
  };
});
```

Display with:
```tsx
<TransactionStatus state={state} onRetry={handleFund} onDismiss={reset} />
```

---

### Blockchain Error Handling

All errors are classified via `parseBlockchainError(err)` into typed `BlockchainError` objects:

| Code | When | Retryable |
|---|---|---|
| `WALLET_NOT_INSTALLED` | Extension missing | No |
| `WALLET_CONNECTION_REJECTED` | User dismissed popup | Yes |
| `WALLET_SIGNATURE_REJECTED` | User declined signing | Yes |
| `WALLET_NETWORK_MISMATCH` | Wrong network in wallet | Yes |
| `WALLET_LOCKED` | Wallet needs unlock | Yes |
| `NETWORK_UNAVAILABLE` | No internet / Horizon down | Yes |
| `RPC_FAILURE` | Soroban RPC error | Yes |
| `TRANSACTION_TIMEOUT` | Confirmation timed out | Yes |
| `SIMULATION_FAILED` | Invalid parameters / state | No |
| `INSUFFICIENT_BALANCE` | Not enough XLM | No |
| `CONTRACT_INVALID_STATE` | Wrong escrow lifecycle state | No |
| `CONTRACT_UNAUTHORIZED` | Not the organizer/admin | No |
| `CONTRACT_EXECUTION_FAILED` | Contract panic | No |
| `TRANSACTION_FAILED` | Network rejected tx | No |
| `DUPLICATE_TRANSACTION` | Already submitted | No |

Each error carries a `userMessage` (shown in UI), `devMessage` (logged to console), `recoveryAction` (guidance for the user), and `retryable` flag (whether to show a Try Again button).

---

### Real-Time Event Synchronization

Blockchain events are synchronized to the frontend via two channels:

**1. Supabase Realtime** — instant DB-level updates when the backend writes to `escrow_accounts` or `transactions`:

```tsx
const { escrowState, events } = useBlockchainEvents({
  eventId,
  onEvent: (event) => {
    if (event.type === "deposit") refetchEscrowBalance();
  },
});
```

**2. Contract event polling** — `GET /api/events/[id]/contract-events` polls Soroban RPC for on-chain events every 15 seconds (configurable). Deduplicated by event ID. Works with SSE-compatible clients if needed.

**Event flow:**

```
Soroban contract event emitted
  → GET /api/events/[id]/contract-events (polled every 15s)
  → useBlockchainEvents deduplicates + fires onEvent()
  → Component re-renders with latest state

Simultaneously:
  Backend service writes to DB (after tx confirmation)
  → Supabase Realtime pushes row change
  → useBlockchainEvents updates escrowState immediately
  → No page refresh needed
```

---

### UI Components

| Component | Location | Purpose |
|---|---|---|
| `WalletButton` | `components/wallet/WalletButton.tsx` | Nav bar: shows connected wallet or Connect button |
| `WalletMenu` | `components/wallet/WalletMenu.tsx` | Dropdown: wallet details, switch, disconnect, picker |
| `WalletConnect` | `components/wallet/wallet-connect.tsx` | Full link + verify flow (Settings page) |
| `TransactionStatus` | `components/blockchain/TransactionStatus.tsx` | Inline lifecycle: status + tx hash + explorer link + errors |
| `TransactionHistory` | `components/blockchain/TransactionHistory.tsx` | Paginated on-chain tx list with explorer links |
| `BlockchainStatusBadge` | `components/blockchain/BlockchainStatusBadge.tsx` | Escrow state pill + sync indicator + balance |

---

### Security Notes

- `STELLAR_ESCROW_SECRET` must **never** be committed. It exists in `.env` (the template); put the actual value only in `web/.env.local` which is `.gitignore`d.
- All Soroban operations (initialize, lock, disburse, refund) run server-side only (`import "server-only"`). The platform keypair is decrypted from KMS at runtime.
- Wallet-to-user binding requires challenge-response signature proof before a wallet can receive disbursements.
- Network mismatch (e.g. wallet on mainnet, app on testnet) is caught at two layers: UI warning in `WalletProvider`, hard rejection in `guardCrossNetwork()` on the server.

---

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Wallet picker shows "No wallets detected" | No extension installed | Install Freighter or LOBSTR |
| "Network mismatch" warning | Wallet set to wrong network | Switch wallet to Testnet |
| Simulation failed | Contract not initialized or wrong state | Check `ESCROW_CONTRACT_ID` and escrow lifecycle state |
| `queryEscrowState` returns null | Platform account not funded | Fund `STELLAR_ESCROW_SECRET` account via Friendbot |
| Challenge expired | >5 min between challenge and sign | Click Verify again to get a fresh challenge |
| Real-time events not updating | Supabase Realtime not enabled | Enable Realtime on `escrow_accounts` and `transactions` tables in Supabase Dashboard |
| Contract ID not responding | Testnet reset | Redeploy with `npx tsx scripts/deploy-contract.ts` and update `ESCROW_CONTRACT_ID` |

---

## Stellar Builder Challenge

This project is a submission for the **Stellar Journey to Mastery — Monthly Builder Challenges (White Belt)**.

### Requirement Mapping

| Requirement | Implementation |
|---|---|
| Wallet setup & connection | `web/components/wallet/wallet-connect.tsx` — Freighter API integration |
| Balance display | `web/app/(app)/settings/page.tsx` + `/api/wallets/[public_key]/balance` — live XLM balance via Horizon |
| Transaction flow | `web/app/(app)/events/[id]/escrow/page.tsx` — organizer funds escrow by signing a Soroban `deposit` transaction via Freighter |
| Transaction result | Real-time feedback displayed post-signing with on-chain confirmation polling |

### Network Configuration

The app defaults to **Stellar Testnet**. To test locally:

1. Install the [Freighter extension](https://www.freighter.app/) and set it to Testnet
2. Fund a testnet account at `https://friendbot.stellar.org?addr=<YOUR_PUBLIC_KEY>`
3. Set `STELLAR_NETWORK_MODE=testnet` in `.env.local`
4. Deploy the Soroban escrow contract to testnet and set `ESCROW_CONTRACT_ID`

---

## Security

Security is a first-class concern given the financial nature of the platform.

- **Secrets management**: Platform signing keys are KMS-encrypted at rest; never stored in plaintext
- **Row Level Security**: All Supabase tables enforce RLS policies; the service-role key is never exposed to the browser
- **Server-only boundaries**: `import "server-only"` prevents sensitive modules from being bundled client-side
- **Input validation**: All API input is parsed through Zod schemas before reaching service logic
- **Rate limiting**: Per-route rate limiting via Upstash Redis with in-memory fallback
- **CSP**: Content Security Policy headers with per-request nonces enforced at the middleware layer
- **Audit trail**: All financial operations and state transitions are logged via the audit service

To report a vulnerability, please open a private GitHub Security Advisory rather than a public issue.

---

## License

This project is licensed under the [MIT License](LICENSE).
