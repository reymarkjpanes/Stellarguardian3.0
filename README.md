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

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 4, Motion, React Router 7, Sonner Toast
- **Backend**: Node.js, Express 4, Kysely, SQLite (`better-sqlite3`), Zod, Helmet, Express Rate Limit
- **Blockchain**: Stellar SDK, Soroban Smart Contracts (Rust)
- **Testing**: Vitest, Supertest, Playwright
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

4. **Run Database Migrations**:
   ```bash
   npm run db:migrate
   ```

5. **Start the Development Server**:
   ```bash
   npm run dev
   ```

   The app will be running at **http://localhost:3000**!

---

## 📜 Available NPM Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express server and Vite development server |
| `npm run db:migrate` | Runs all pending SQLite database migrations |
| `npm run db:rollback` | Rollbacks the latest database migration |
| `npm run build` | Builds the client bundle and bundles `server.ts` into `dist/server.cjs` |
| `npm run start` | Runs the production build from `dist/server.cjs` |
| `npm run test` | Runs the unit & integration test suite with Vitest |
| `npm run test:watch` | Runs Vitest in interactive watch mode |
| `npm run lint` | Type checks the project with `tsc --noEmit` |

---

## 📁 Repository Structure

```
stellar-guardian-3.0/
├── .agents/              # Agent skills, rules (AGENTS.md), and taste configurations
├── assets/               # Static images and brand assets
├── server/
│   ├── db/               # SQLite client, migrations, and Kysely schema definitions
│   ├── middleware/       # Auth, error handling, CSP nonces, and validation
│   ├── routes/           # Modular Express routes (auth, stellar, notifications, etc.)
│   └── schemas/          # Zod request payload validation schemas
├── src/
│   ├── components/       # Reusable React components & UI primitives
│   ├── context/          # React context providers (Auth, Theme, Workspace)
│   ├── pages/            # Application routes & view views
│   └── types.ts          # Core TypeScript interface contracts
├── index.html            # Main HTML entrypoint
├── package.json          # Dependency manifest and scripts
├── server.ts             # Main Express + Vite integration server
└── vite.config.ts        # Vite bundler configuration
```

---

## 🔒 Security Policy

Security is a core priority for Stellar Guardian. If you discover a potential vulnerability, please report it directly via GitHub issues or email the maintainers rather than creating public disclosures.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
