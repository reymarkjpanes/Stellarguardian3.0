<div align="center">

# Stellar Guardian 3.0

**Trustless Hackathon, Bounty & Grant Management on the Stellar Network**

[![CI](https://github.com/reymarkjpanes/Stellarguardian3.0/actions/workflows/ci.yml/badge.svg)](https://github.com/reymarkjpanes/Stellarguardian3.0/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Stellar](https://img.shields.io/badge/Stellar-Soroban-141414?logo=stellar&logoColor=white)](https://stellar.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Stellar Guardian 3.0 is a full-stack platform for running hackathons, competitive bounties, and grant programmes with **trustless prize settlement via Soroban smart contracts** on the Stellar blockchain. Prize funds are locked on-chain and released automatically to winners — no manual intervention, no trust required.

[Demo Video](https://drive.google.com/file/d/1K4lYCkc9Mw61nKVQJ3V5mIvA76o81oo2/view?usp=sharing) · [Contract on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT) · [GitHub Actions](https://github.com/reymarkjpanes/Stellarguardian3.0/actions)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Running Locally](#running-locally)
- [Available Commands](#available-commands)
- [Smart Contract](#smart-contract)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [License](#license)

---

## Overview

Traditional hackathons rely on organizers to hold and manually distribute prize funds. Stellar Guardian removes that trust requirement by locking prize pools in a **Soroban smart contract escrow**. Funds are verifiable on-chain from the moment they're deposited, and disbursed automatically to ranked winners once judging is finalized.

The platform handles the full event lifecycle: creation, registration, team formation, submission, judging, dispute resolution, and on-chain payout.

---

## Key Features

- **16-state event lifecycle** — pure TypeScript state machine enforcing valid transitions with property-based tests
- **Soroban escrow contract** — prize pools locked on-chain; multi-batch disbursement; automatic refund on cancellation
- **5 wallet integrations** — Freighter, xBull, LOBSTR, Albedo, Rabet via a unified adapter interface
- **Role-based permissions** — 10 roles with typed RBAC + ABAC enforced server-side on every API route
- **KMS envelope encryption** — AES-256-GCM in dev; AWS KMS in production; signing keys never stored in plaintext
- **Wallet ownership verification** — challenge-response signature proof before a wallet can receive disbursements
- **Real-time sync** — Supabase Realtime + Soroban event polling keep escrow state current without page refresh
- **Dispute resolution** — built-in dispute window with state machine; unresolved disputes block payout
- **Typed error hierarchy** — `AppError`, `ValidationError`, `AuthorizationError`, `BlockchainError` and more; all validated with property-based tests

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth with SSR cookie adapter |
| Blockchain | `@stellar/stellar-sdk` ^16 + Soroban |
| Validation | Zod 4 |
| Testing | Vitest + fast-check (property-based) + Playwright (E2E) |
| Email | Resend |
| Rate Limiting | Upstash Redis (in-memory fallback) |
| Encryption | AWS KMS (prod) / AES-256-GCM (dev) |
| Smart Contract | Rust + Soroban SDK 22.x, target `wasm32v1-none` |
| Deployment | Vercel |

---

## Prerequisites

**Web application:**

- Node.js 24+
- npm 10+
- A [Supabase](https://supabase.com/dashboard) project (free tier works)
- A [Freighter](https://www.freighter.app/) browser extension set to **Testnet**
- A funded Stellar Testnet account — use [Friendbot](https://friendbot.stellar.org)

**Smart contract (only needed if redeploying):**

- Rust stable 1.84+ with the `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/stellar-cli) v25+

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/reymarkjpanes/Stellarguardian3.0.git
cd Stellarguardian3.0

# 2. Install root tooling
npm install

# 3. Install web app dependencies
cd web && npm install && cd ..
```

---

## Environment Setup

Copy the example file and fill in your values:

```bash
cp .env.example web/.env.local
```

Open `web/.env.local` and configure the following:

```env
# Supabase — get from your project dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Encryption — minimum 32 characters, generated with: openssl rand -hex 32
LOCAL_ENCRYPTION_KEY=your-32-char-secret-key

# Stellar
STELLAR_NETWORK_MODE=testnet
STELLAR_MAINNET_ENABLED=false
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
ESCROW_CONTRACT_ID=CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=your-cron-secret

# Optional — app degrades gracefully without these
RESEND_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

> The `ESCROW_CONTRACT_ID` above is the deployed testnet contract. Use it as-is for local development.

**Full variable reference:**

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (client-side, subject to RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (server-only, bypasses RLS) |
| `LOCAL_ENCRYPTION_KEY` | ✅ | 32+ char string — dev KMS key |
| `STELLAR_NETWORK_MODE` | ✅ | `testnet` or `mainnet` |
| `STELLAR_MAINNET_ENABLED` | ✅ | `true` only when targeting mainnet |
| `SOROBAN_RPC_URL` | ✅ | Soroban RPC endpoint |
| `ESCROW_CONTRACT_ID` | ✅ | Deployed Soroban contract ID |
| `NEXT_PUBLIC_SITE_URL` | ✅ | App base URL |
| `CRON_SECRET` | ✅ | Bearer secret for Vercel Cron routes |
| `RESEND_API_KEY` | Optional | Transactional email |
| `UPSTASH_REDIS_REST_URL` + `TOKEN` | Optional | Distributed rate limiting |
| `KMS_KEY_ARN` + `AWS_REGION` | Production | AWS KMS (replaces `LOCAL_ENCRYPTION_KEY`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | Optional | Cloudflare Turnstile CAPTCHA |

---

## Database Setup

Migrations live in `web/supabase/migrations/`. Apply them using one of these methods:

**Option A — Hosted Supabase (recommended for getting started):**

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor**
3. Paste and run the contents of `web/supabase/combined_migration.sql`

**Option B — Supabase CLI (local development):**

```bash
cd web
npx supabase start        # starts local Postgres + Studio
npx supabase db push      # applies all migrations in order
```

To seed initial data:

```bash
cd web
npm run seed
```

---

## Running Locally

```bash
# From the repo root
npm run dev
```

The app runs at **http://localhost:3000**.

Make sure you have:
1. Completed [Environment Setup](#environment-setup)
2. Applied [Database migrations](#database-setup)
3. Freighter wallet extension installed and set to **Testnet**

---

## Available Commands

All commands can be run from the **repo root** or from `web/` directly.

### Web application

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR (`localhost:3000`) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint across all files |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (used in CI) |
| `npm run test` | Vitest unit tests (single run) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with V8 coverage |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run seed` | Run database seed script |

### Smart contract

Run from `contracts/escrow/`:

```bash
# Run unit tests
cargo test --locked

# Build optimised WASM
cargo build --locked --target wasm32v1-none --release

# Lint
cargo clippy --all-targets -- -D warnings

# Format check
cargo fmt --all -- --check
```

---

## Smart Contract

The Soroban escrow contract is written in Rust and lives in `contracts/escrow/src/lib.rs`.

**Deployed on Stellar Testnet:**
```
CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT
```

| Explorer | Link |
|---|---|
| Stellar Expert | [View contract](https://stellar.expert/explorer/testnet/contract/CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT) |
| Stellar Lab | [View in Lab](https://lab.stellar.org/smart-contracts/contract-explorer?network=testnet&contractId=CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT) |

**Contract functions:**

| Function | Who calls it | Description |
|---|---|---|
| `initialize` | Platform | One-time setup — sets organizer, target, and token |
| `deposit` | Organizer | Locks XLM via Freighter signature |
| `admin_deposit` | Platform | Sponsor deposit from any address |
| `lock` | Platform | Locks escrow once fully funded |
| `disburse` | Platform | Single-batch payout → transitions to Released |
| `disburse_batch` | Platform | Multi-batch payout (stays Locked until `finalize`) |
| `finalize` | Platform | Marks all batches complete → Released |
| `refund` | Platform | Returns balance to organizer on cancellation |

**Escrow lifecycle:**
```
PendingFunding → PartiallyFunded → FullyFunded → Locked → Released
                                                        ↘ Refunded (on cancellation)
```

**Redeploying the contract:**

```bash
cd contracts/escrow

# Install target (first time only)
rustup target add wasm32v1-none

# Build
cargo build --locked --target wasm32v1-none --release

# Deploy (requires Stellar CLI and a funded account)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/stellar_guardian_escrow.wasm \
  --source <YOUR_SECRET_KEY> \
  --network testnet
```

Update `ESCROW_CONTRACT_ID` in `web/.env.local` with the new address.

---

## Project Structure

```
stellar-guardian-3.0/
├── web/                              # Next.js 16 application
│   ├── app/
│   │   ├── (auth)/                   # Login, signup, reset-password
│   │   ├── (app)/                    # Authenticated app shell
│   │   │   ├── dashboard/
│   │   │   ├── events/[id]/          # Event detail and sub-routes
│   │   │   │   ├── teams/
│   │   │   │   ├── submissions/
│   │   │   │   ├── judging/
│   │   │   │   ├── winners/
│   │   │   │   ├── disputes/
│   │   │   │   └── escrow/
│   │   │   └── settings/
│   │   └── api/                      # Route handlers
│   ├── components/                   # Shared React components
│   ├── lib/
│   │   ├── auth/                     # Authorization middleware
│   │   ├── engines/                  # Permission + workflow engines
│   │   ├── errors/                   # Typed error hierarchy
│   │   ├── services/                 # Business logic services
│   │   ├── state-machine/            # Event, escrow, dispute state machines
│   │   ├── stellar/                  # Soroban contract client
│   │   └── wallet/                   # Wallet adapters (5 providers)
│   ├── src/domains/                  # DDD bounded contexts
│   │   ├── judging/
│   │   ├── submissions/
│   │   ├── teams/
│   │   ├── members/
│   │   ├── rankings/
│   │   └── escrow/
│   ├── supabase/
│   │   ├── migrations/               # Numbered SQL migrations
│   │   └── combined_migration.sql    # Single-file for quick setup
│   └── tests/
│       ├── unit/                     # Vitest unit tests
│       └── e2e/                      # Playwright E2E tests
├── contracts/
│   └── escrow/                       # Soroban smart contract (Rust)
│       ├── src/lib.rs
│       ├── Cargo.toml
│       └── rust-toolchain.toml
├── .github/workflows/ci.yml          # CI pipeline
└── package.json                      # Root script proxy
```

---

## Deployment

The app is designed for deployment on **Vercel**.

1. Push to GitHub and connect the repo to Vercel
2. Set all environment variables from [Environment Setup](#environment-setup) in the Vercel dashboard
3. Set the **Root Directory** to `web/`
4. Vercel auto-detects Next.js and configures the build

**Production-specific variables to add:**

```env
NODE_ENV=production
STELLAR_MAINNET_ENABLED=true   # only if targeting mainnet
KMS_KEY_ARN=arn:aws:kms:...    # AWS KMS key for production signing key encryption
AWS_REGION=us-east-1
```

**Cron jobs** are configured in `web/vercel.json` and run automatically on Vercel:

| Cron | Schedule | Purpose |
|---|---|---|
| `/api/cron/cleanup` | Every hour | Idempotency key cleanup |
| `/api/cron/escrow-reconcile` | Every 15 min | Escrow state sync |

---

## Troubleshooting

**Freighter shows "Network mismatch"**
Switch Freighter to **Testnet** in the extension settings.

**`queryEscrowState` returns null**
The platform escrow account (`STELLAR_ESCROW_SECRET`) is not funded. Run:
```bash
curl "https://friendbot.stellar.org?addr=<YOUR_ESCROW_PUBLIC_KEY>"
```

**Simulation failed**
The contract may not be initialized or the escrow is in the wrong state. Check `ESCROW_CONTRACT_ID` is correct and the escrow lifecycle state in the dashboard.

**Testnet reset — contract not responding**
Stellar Testnet resets periodically. Redeploy the contract (see [Smart Contract](#smart-contract)) and update `ESCROW_CONTRACT_ID`.

**`hashbrown` / `edition2024` compile error**
Make sure you're using Rust stable 1.84+ and the `wasm32v1-none` target:
```bash
rustup update stable
rustup target add wasm32v1-none
```

**Database migration fails**
Ensure migrations run in order. Use `combined_migration.sql` for a clean setup. To roll back a specific migration, use the corresponding file in `web/supabase/migrations_down/`.

**Emails not sending**
`RESEND_API_KEY` is optional. Without it, emails are silently skipped. Add the key and verify your domain in the [Resend dashboard](https://resend.com).

**Rate limit errors in development**
Without `UPSTASH_REDIS_REST_URL`, rate limiting falls back to in-memory. This resets on server restart and is expected in development.

---

## Security

- **Secrets**: Platform signing keys are KMS-encrypted at rest — never stored in plaintext
- **RLS**: All Supabase tables enforce Row Level Security; the service-role key is never exposed to the browser
- **Server-only boundaries**: `import "server-only"` prevents sensitive modules from being bundled client-side
- **Input validation**: All API input parsed through Zod schemas before reaching service logic
- **CSP**: Content Security Policy headers with per-request nonces at the middleware layer
- **Audit trail**: All financial operations and state transitions are logged via the audit service
- **Wallet verification**: Challenge-response signature proof required before a wallet can receive disbursements

To report a vulnerability, open a [private GitHub Security Advisory](https://github.com/reymarkjpanes/Stellarguardian3.0/security/advisories/new) rather than a public issue.

---

## License

[MIT](LICENSE) — Reymark Panes, 2025
