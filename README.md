<div align="center">

# 🛡️ Stellar Guardian 3.0

**Decentralized Hackathon, Bounty & Event Management Platform on Stellar**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-Better--SQLite3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Stellar](https://img.shields.io/badge/Stellar-SDK%2016.0-141414?logo=stellar&logoColor=white)](https://stellar.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

Stellar Guardian 3.0 is a full-stack, enterprise-ready platform designed to host, manage, and settle hackathons, competitive bounties, and grants transparently using **Soroban Smart Contracts** on the **Stellar Blockchain**.

</div>

---

## 🏆 Stellar Builder Challenge (White Belt) Submission

This project satisfies all requirements for the **Stellar Journey to Mastery Monthly Builder Challenges (White Belt)**:

1. **Wallet Setup & Connection** (`web/components/wallet/wallet-connect.tsx`)
   - Uses the official `@stellar/freighter-api` to connect to the Freighter Wallet on the Stellar Testnet.
   - Users can securely connect and disconnect their wallets on the **Settings** page.

2. **Balance Handling** (`web/app/(app)/settings/page.tsx` & `web/app/api/wallets/[public_key]/balance/route.ts`)
   - Fetches and clearly displays the connected wallet's native XLM balance using the Horizon API directly in the UI.

3. **Transaction Flow** (`web/app/(app)/events/[id]/escrow/page.tsx`)
   - Users can fund hackathon prize escrows by signing a Testnet XLM transaction with their connected Freighter wallet.
   - The UI shows real-time transaction feedback (success/failure) and displays the updated on-chain balance.

### Required Screenshots

#### 1. Wallet Connected State
> *(Replace this placeholder with a screenshot of the Settings page showing the connected wallet)*
![Wallet Connected](./docs/wallet-connected.png)

#### 2. Balance Displayed
> *(Replace this placeholder with a screenshot of the Settings page showing the fetched XLM balance)*
![Balance Displayed](./docs/balance-displayed.png)

#### 3. Successful Testnet Transaction
> *(Replace this placeholder with a screenshot of Freighter asking to sign the transaction during escrow funding)*
![Successful Transaction](./docs/successful-transaction.png)

#### 4. Transaction Result Shown to User
> *(Replace this placeholder with a screenshot of the success message after funding the escrow)*
![Transaction Result](./docs/transaction-result.png)

---

## 🌟 Key Features

### 🛡️ Smart Contract Escrow & Settlement
- **Soroban Integration**: Trustless prize funding, automated winner payouts, and refund mechanisms built with Stellar Soroban smart contracts.
- **Horizon Network Client**: Native transaction building, account funding, and balance monitoring for Stellar Testnet & Mainnet.

### 🔄 16-State Event Lifecycle Engine
- **End-to-End Workflow**: Fully structured state machine governing competition phases:
  `Draft` ➔ `Registration Open` ➔ `Submissions Open` ➔ `Review/Judging` ➔ `Winner Selection` ➔ `Disbursement` ➔ `Completed`.
- **Review Expiry Cron**: Automatic lifecycle transition management to keep events moving smoothly.

### 👥 Teams, Submissions & Judging System
- **Team Workflows**: Create teams, invite members, and manage join request approvals.
- **Submission Versioning**: Track submission history and edit iterations without losing data.
- **Configurable Rubrics**: Custom scoring criteria and automated leaderboard calculations for event judges.

### 🔐 Enterprise-Grade Security
- **Strict Authentication**: JWT auth with role-based access control (Admin, Organizer, Judge, Participant).
- **Hardened Server**: Helmet CSP headers with per-request nonces, CORS origin validation, and LRU rate-limiting.
- **KMS Encryption**: Sensitive data protection using AES-256-GCM dev/prod Key Management Service.

### 📧 Notifications & Communication
- **Transactional Emails**: Resend integration for password resets, invitation links, and milestone updates.
- **Activity Timelines**: Real-time event activity streams, comments, and workspace announcements.

### 🎨 Modern Anti-Slop UI & Accessibility
- **Design System**: Built with React 19, Tailwind CSS 4, Motion (Framer Motion), and Lucide icons.
- **Accessibility (a11y)**: WCAG 2.4.1 skip-to-content support, keyboard navigation, and aria-labels.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Database**: Supabase PostgreSQL with RLS
- **Styling**: Tailwind CSS 4, Motion (Framer Motion)
- **Blockchain**: Stellar SDK, Freighter API, Soroban Smart Contracts
- **Validation**: Zod
- **Services**: Resend Email API, Google Gemini AI API

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm** or **Bun** package manager
- **Stellar Account**: Testnet account for escrow testing ([Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test))

---

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/reymarkjpanes/Stellarguardian3.0.git
   cd Stellarguardian3.0
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

   *Minimal required configuration in `.env.local`*:
   ```env
   JWT_SECRET=your_32_character_hex_secret_here
   PORT=3000
   NODE_ENV=development
   APP_URL=http://localhost:3000
   STELLAR_NETWORK=testnet
   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
   ```

4. **Supabase Local Development**:
   If you have the Supabase CLI installed, you can start the local database:
   ```bash
   cd web
   npx supabase start
   ```

5. **Start the Development Server**:
   ```bash
   npm run dev
   ```

   The app will be running at **http://localhost:3000**!

---

## 📜 Available NPM Scripts

All scripts in the root directory are proxied to the `web/` application folder:

| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server |
| `npm run build` | Builds the Next.js application for production |
| `npm run start` | Runs the Next.js production server |
| `npm run lint` | Runs ESLint type checks |

---

## 📁 Repository Structure

```
stellar-guardian-3.0/
├── .agents/              # Agent skills, rules (AGENTS.md), and taste configurations
├── contracts/            # Soroban Smart Contracts (Rust)
├── web/                  # Next.js 16 Application (App Router)
│   ├── app/              # Application routes (API and UI)
│   ├── components/       # Reusable React components & UI primitives
│   ├── lib/              # Services, State Machine, and Utilities
│   ├── supabase/         # Supabase configuration and DB migrations
│   └── middleware.ts     # Edge middleware for auth and CSP
├── package.json          # Root proxy runner
└── README.md             # Project documentation
```

---

## 🔒 Security Policy

Security is a core priority for Stellar Guardian. If you discover a potential vulnerability, please report it directly via GitHub issues or email the maintainers rather than creating public disclosures.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
