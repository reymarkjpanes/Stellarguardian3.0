# Stellar Guardian 3.0 — Production Deployment Checklist

**Date:** August 3, 2026
**Status:** All code complete. This checklist covers ops/environment steps required before going live.

---

## 1. Environment Variables

Verify all required environment variables are set in your production environment (Vercel / Docker / cloud):

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Production Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Server-only.** Never expose to client. |
| `STELLAR_NETWORK_MODE` | ✅ | Set to `"mainnet"` for production |
| `STELLAR_MAINNET_ENABLED` | ✅ | Set to `"true"` to unlock mainnet transactions |
| `NEXT_PUBLIC_STELLAR_NETWORK` | ✅ | Set to `"mainnet"` for sponsor deposit UI |
| `SOROBAN_RPC_URL` | ✅ | Mainnet: `https://soroban-rpc.mainnet.stellar.gateway.fm` |
| `ESCROW_CONTRACT_ID` | ✅ | Deployed mainnet contract ID |
| `PLATFORM_ADMIN_SECRET` | ✅ | **Critical.** Secret key of platform admin Stellar account. Never commit. |
| `STELLAR_ESCROW_SECRET` | ✅ | Fallback if PLATFORM_ADMIN_SECRET not set. Same key. |
| `KMS_KEY_ARN` | ✅ (prod) | AWS KMS key ARN for escrow key encryption. Must NOT be the dev fallback. |
| `LOCAL_ENCRYPTION_KEY` | ❌ prod | Dev-only. If set in prod, must be cryptographically random 32-byte hex. |
| `UPSTASH_REDIS_REST_URL` | ✅ | For rate limiting. Falls back to in-memory (not cluster-safe without this). |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Auth token for Upstash Redis. |
| `RESEND_API_KEY` | ✅ | For transactional emails (notifications, password reset). |
| `CRON_SECRET` | ✅ | **Randomize before deploy.** Used to authenticate cron endpoints. |
| `AWS_ACCESS_KEY_ID` | ✅ (prod KMS) | AWS credentials for KMS operations. |
| `AWS_SECRET_ACCESS_KEY` | ✅ (prod KMS) | AWS credentials for KMS operations. |
| `AWS_REGION` | ✅ (prod KMS) | AWS region where KMS key is deployed. |

---

## 2. Secrets Audit

Run before deploying:

```bash
# Check for accidentally committed secrets
git log --all --full-history -- "*.env*"
git log --all --full-history -- ".env.local"

# Verify .env files are gitignored
cat .gitignore | grep -E "\.env"

# Scan for hardcoded secrets in code (adjust patterns as needed)
grep -r "GABC\|secret\|private_key" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next | grep -v "// " | grep -v "test"
```

---

## 3. Supabase Production Setup

- [ ] **Run all migrations** on production Supabase project:
  ```bash
  npx supabase db push --project-ref <your-project-ref>
  ```
- [ ] **Verify RLS is enabled** on all 24 tables (check `20250101000052_restrict_financial_rls.sql` is applied)
- [ ] **Set up auth email templates** — confirm email, password reset
- [ ] **Configure `emailRedirectTo` allowed URLs** in Supabase Auth settings:
  - Add `https://your-domain.com/auth/callback` to allowed redirect URLs
- [ ] **Enable `PKCE` flow** in Supabase Auth settings (required for `/auth/callback` handler)
- [ ] **Configure SMTP** for Resend (or use Supabase SMTP)

---

## 4. Stellar / Soroban Production Setup

- [ ] **Deploy escrow contract to mainnet:**
  ```bash
  npx tsx scripts/deploy-contract.ts --network mainnet
  ```
  Copy the returned contract ID to `ESCROW_CONTRACT_ID` env var.

- [ ] **Fund platform admin account** — needs at least 100 XLM for transaction fees + reserves

- [ ] **Rotate `PLATFORM_ADMIN_SECRET`** — generate a fresh keypair:
  ```bash
  node -e "const { Keypair } = require('@stellar/stellar-sdk'); const kp = Keypair.random(); console.log('Public:', kp.publicKey()); console.log('Secret:', kp.secret());"
  ```
  Store secret in your secret manager (AWS Secrets Manager, Vercel Env, etc.). **Never commit it.**

- [ ] **Verify `STELLAR_MAINNET_ENABLED=true`** — without this, the `guardMainnet()` check blocks all mainnet ops

- [ ] **Set Soroban RPC URL** for mainnet — the testnet URL is the default and will not work on mainnet

---

## 5. KMS Production Setup

- [ ] **Create an AWS KMS Symmetric key** in your region
- [ ] **Set `KMS_KEY_ARN`** to the full ARN (e.g., `arn:aws:kms:us-east-1:123456789:key/abc-123`)
- [ ] **Remove `LOCAL_ENCRYPTION_KEY`** from production env or leave it unset — with `KMS_KEY_ARN` set, KMS is used instead
- [ ] **Migrate any existing escrow keys** that were encrypted with local AES:
  ```bash
  npx tsx scripts/migrate-escrow-keys.ts
  ```

---

## 6. Cron Jobs

Configure the following cron jobs in Vercel (or your scheduler):

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `POST /api/cron/escrow` | Every 5 minutes | Auto-trigger Soroban payout when `PrizeApproved` |
| `POST /api/cron/reconcile` | Every 15 minutes | Reconcile escrow balances |
| `POST /api/cron/transitions` | Every 15 minutes | Auto-close registrations past deadline |
| `POST /api/cron/cleanup-idempotency` | Daily | Purge expired idempotency keys |

All cron calls require `Authorization: Bearer <CRON_SECRET>` header.

---

## 7. Pre-Launch Smoke Tests

After deploying, verify these manually:

- [ ] Guest can visit landing page, discover page, sign up, confirm email, and land on onboarding
- [ ] Organizer can create an event, publish it, open registration, and transition through the full lifecycle
- [ ] Participant can register, join a team, submit, and view their feedback after completion
- [ ] Sponsor can view the sponsors page and see the "Fund Escrow" panel (requires `PendingFunding` escrow state)
- [ ] Admin can navigate to `/admin` via profile menu and see audit logs with filtering
- [ ] Escrow can be created and funded via the Escrow tab on an event
- [ ] A test disbursement completes without errors in testnet before going mainnet

---

## 8. Monitoring

- [ ] Set up Vercel error alerting or Sentry
- [ ] Enable Supabase log drain to a log aggregator
- [ ] Set up uptime monitoring on `/api/health` and `/api/health/ready`
- [ ] Configure alerts for failed cron jobs (escrow trigger failures especially)

---

*Generated August 3, 2026. All code changes are in MASTER_IMPLEMENTATION_PLAN.md.*
