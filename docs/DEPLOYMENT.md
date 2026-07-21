# Deployment Guide — Stellar Guardian 3.0

## Prerequisites

- Node.js 20+
- Supabase project (database + auth)
- Stellar testnet/mainnet account
- Upstash Redis account (for rate limiting)
- AWS account with KMS key (for production encryption)
- Vercel account (recommended) or any Node.js hosting

## Environment Variables

Copy `web/.env.example` to `web/.env.local` for development.
For production, set all required variables in your hosting provider's dashboard.

### Required (all environments)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `LOCAL_ENCRYPTION_KEY` | 32+ char random string (dev only) |
| `CRON_SECRET` | Random secret for cron job authentication |
| `STELLAR_NETWORK_MODE` | `testnet` or `mainnet` |

### Required for Production

| Variable | Description |
|----------|-------------|
| `KMS_KEY_ARN` | AWS KMS key ARN for escrow secret encryption |
| `AWS_REGION` | AWS region for KMS |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `STELLAR_MAINNET_ENABLED` | Set to `true` only when ready for real XLM |

### Optional

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Email sending via Resend |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint |
| `ESCROW_CONTRACT_ID` | Deployed Soroban contract ID |

## Database Setup

1. Create a Supabase project
2. Run migrations in order:
   ```bash
   cd web
   npx supabase db push
   ```
3. Verify RLS policies are active on all tables

## Deployment Steps

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Set framework preset to **Next.js**
3. Set root directory to `web/`
4. Add all environment variables in Vercel dashboard
5. Deploy — Vercel will run `next build` automatically
6. Cron jobs are configured via `web/vercel.json`

### Manual Deployment

```bash
cd web
npm ci
npm run build
npm start
```

## Post-Deployment Verification

1. **Health check**: `GET /api/health` should return `{ status: "ok" }`
2. **Readiness**: `GET /api/health/ready` should return all checks passing
3. **Auth**: Navigate to `/login` — should render without errors
4. **Cron**: Manually trigger `/api/cron/transitions` with:
   ```bash
   curl -X POST https://your-domain.com/api/cron/transitions \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

## Security Checklist (Pre-Launch)

- [ ] `STELLAR_MAINNET_ENABLED` is `false` until explicitly ready
- [ ] `KMS_KEY_ARN` is set (not using LOCAL_ENCRYPTION_KEY in prod)
- [ ] Rate limiting is active (verify with rapid requests → 429)
- [ ] HSTS preload submitted to hstspreload.org
- [ ] CSP headers verified (check browser console for violations)
- [ ] RLS enabled on ALL Supabase tables
- [ ] Service role key not exposed in any client-side code
- [ ] CRON_SECRET is unique and rotated periodically

## Monitoring

- Health: `/api/health/ready` for uptime monitoring
- Errors: Configure Sentry via `SENTRY_DSN` env var
- Financials: Monitor `audit_records` table for `escrow.*` actions
- Reconciliation: `/api/cron/reconcile` runs every 30 min, check for inconsistencies
