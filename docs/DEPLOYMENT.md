# Deployment Guide — Stellar Guardian 3.0

## Prerequisites

- Node.js 20+
- Vercel account (or compatible Next.js hosting)
- Supabase project (with Pro plan for production)
- Upstash Redis instance
- Cloudflare Turnstile keys
- Resend API key (email)
- AWS KMS key (production escrow encryption)
- Stellar Testnet funded account (platform keypair)

## Environment Variables

Copy `web/.env.example` to your deployment environment. All variables are documented there.

**Critical production variables:**

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operations | Yes |
| `KMS_KEY_ARN` | AWS KMS key for escrow encryption | Yes (mainnet) |
| `LOCAL_ENCRYPTION_KEY` | 32-byte hex key for dev/testnet | Yes (testnet) |
| `UPSTASH_REDIS_REST_URL` | Rate limiting | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting auth | Yes |
| `CRON_SECRET` | Cron endpoint auth | Yes |
| `TURNSTILE_SECRET_KEY` | CAPTCHA verification | Yes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | CAPTCHA widget | Yes |
| `RESEND_API_KEY` | Email notifications | Yes |
| `STELLAR_NETWORK_MODE` | `testnet` or `mainnet` | Yes |
| `STELLAR_MAINNET_ENABLED` | `true` to enable mainnet ops | Only for mainnet |

## Deployment Steps

### 1. Database Setup

```bash
# Apply all migrations in order
cd web
npx supabase db push
```

Verify migrations applied:
- `20250101000001` through `20250101000013` (core schema)
- `20250722000004` (financial precision)
- `20250722000005` (domain events outbox)
- `20250722000006` (dispute deadline + prize split)

### 2. Vercel Deployment

```bash
# From project root
vercel deploy --prod
```

Or connect the Git repository to Vercel for auto-deployment.

### 3. Cron Job Configuration

Add to `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/process-events", "schedule": "* * * * *" },
    { "path": "/api/cron/transitions", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/reconcile", "schedule": "*/30 * * * *" },
    { "path": "/api/cron", "schedule": "0 * * * *" }
  ]
}
```

Each cron request must include `Authorization: Bearer <CRON_SECRET>`.

### 4. Post-Deployment Verification

1. Hit `/api/health` — should return `{ status: "ok" }`
2. Hit `/api/health/ready` — should show all deps as `ok`
3. Visit `/login` — verify page loads with CAPTCHA widget
4. Visit `/signup` — test registration flow
5. Visit `/discover` — verify public events load

### 5. Mainnet Activation

**Only after thorough testnet validation:**

1. Set `STELLAR_NETWORK_MODE=mainnet`
2. Set `STELLAR_MAINNET_ENABLED=true`
3. Configure production KMS key ARN
4. Deploy updated Soroban contract to mainnet
5. Verify MFA enforcement works (attempt disbursement without MFA → 403)

## Monitoring

- Health: `/api/health/ready` (503 = critical dep down)
- Errors: Sentry DSN (when configured)
- Financial: Watch `audit_records` for failed transactions
- Reconciliation: Check cron output for `inconsistent: > 0`

## Rollback

```bash
# Revert to previous deployment
vercel rollback

# Database rollback (if needed)
# Migrations have _down files in web/supabase/migrations_down/
```

## Security Checklist (Pre-Production)

- [ ] All env vars set (no empty strings)
- [ ] `CRON_SECRET` is a strong random value (32+ chars)
- [ ] `LOCAL_ENCRYPTION_KEY` is NOT the default dev value
- [ ] `KMS_KEY_ARN` configured for mainnet
- [ ] Rate limiting verified (hit `/api/auth/login` 6 times → 429)
- [ ] CAPTCHA verified (signup without solving → blocked)
- [ ] MFA verified (mainnet disburse without AAL2 → 403)
- [ ] CSP headers present (check response headers)
- [ ] HSTS preload active
