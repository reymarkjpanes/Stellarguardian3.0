# Operational Runbook — Stellar Guardian 3.0

## Common Operational Tasks

### 1. Secret Rotation

**Rotate CRON_SECRET:**
1. Generate new secret: `openssl rand -hex 32`
2. Update in deployment environment
3. Redeploy (crons will use new secret on next invocation)
4. Verify crons still fire (check `/api/cron/process-events` logs)

**Rotate Supabase Service Role Key:**
1. Rotate in Supabase dashboard → Settings → API
2. Update `SUPABASE_SERVICE_ROLE_KEY` in deployment
3. Redeploy immediately (all server operations use this)
4. Verify `/api/health/ready` returns 200

**Rotate KMS Key (escrow encryption):**
1. Deploy `scripts/migrate-escrow-keys.ts` with new key ARN
2. Run migration: re-encrypts all existing escrow secrets
3. Update `KMS_KEY_ARN` in deployment
4. Redeploy
5. Verify disbursement still works (test on testnet event first)

### 2. Database Maintenance

**Apply new migration:**
```bash
cd web && npx supabase db push
```

**Rollback a migration:**
```bash
# Find the corresponding _down file
cat supabase/migrations_down/<migration_name>_down.sql
# Apply manually via Supabase SQL editor (or supabase db reset on staging)
```

**Clean expired idempotency keys (manual):**
```sql
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

**Clean processed domain events (manual):**
```sql
DELETE FROM domain_events WHERE status = 'processed' AND processed_at < NOW() - INTERVAL '7 days';
```

### 3. Escrow Reconciliation

**Manual reconciliation trigger:**
```bash
curl -X POST https://your-domain.com/api/cron/reconcile \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Investigate inconsistency:**
1. Query the flagged escrow: `SELECT * FROM escrow_accounts WHERE inconsistent = true`
2. Compare `expected_balance` vs on-chain balance (check Stellar Expert)
3. Common causes: fee drift, external deposit not tracked, concurrent deposit
4. Resolution: update `expected_balance` to match on-chain if legitimate

### 4. Stuck Disbursement

**Symptoms:** Escrow in `PendingRelease` state, no progress.

**Investigation:**
1. Check `audit_records` for `escrow.disburse` actions
2. Check `winners` table for `disbursement_status = 'pending'` winners
3. Check if advisory lock was released (should auto-release on session end)

**Resolution:**
```sql
-- Reset escrow state if stuck (use with caution)
UPDATE escrow_accounts
SET state = 'Locked', version = version + 1
WHERE event_id = '<event_id>' AND state = 'PendingRelease';
```

Then re-trigger disbursement from the UI.

### 5. Failed Domain Events

**Check dead events:**
```sql
SELECT * FROM domain_events WHERE status = 'dead' ORDER BY created_at DESC;
```

**Manual retry:**
```sql
UPDATE domain_events
SET status = 'pending', attempts = 0, next_retry_at = NOW()
WHERE id = '<event_id>';
```

Then wait for the process-events cron to pick it up.

### 6. User Account Issues

**Suspend a user (admin):**
- Use the admin dashboard: `/admin` → Users → Suspend

**Unsuspend:**
- Same flow, click "Unsuspend"

**Force password reset:**
- Supabase dashboard → Authentication → Users → Find user → Reset password

**Delete account (GDPR request):**
- User can self-serve via Settings → Delete Account
- If user can't access: admin uses `deleteAccount(userId)` via internal tool

## Incident Response

### Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|---------------|---------|
| P1 | Financial loss possible | < 15 min | Double disbursement, escrow drained |
| P2 | Service unavailable | < 1 hour | Supabase down, all API 500s |
| P3 | Feature broken | < 4 hours | Signup failing, cron not firing |
| P4 | Minor issue | Next business day | UI glitch, slow query |

### P1: Financial Incident

1. **Immediately** pause all disbursement crons
2. Check `transactions` table for unexpected entries
3. Check Stellar Expert for unexpected on-chain transfers
4. If double-spend confirmed: contact recipients, document evidence
5. Post-incident: root cause analysis within 24h

### P2: Service Outage

1. Check `/api/health/ready` — identify which dependency is down
2. If Supabase: check status.supabase.com, wait for resolution
3. If Stellar: financial ops degrade gracefully (non-financial still works)
4. If Redis: rate limiting falls back to no-op (log warning, monitor for abuse)
5. Communicate to users if outage > 30 min

## Monitoring Alerts (When Configured)

| Alert | Condition | Action |
|-------|-----------|--------|
| Error rate spike | 5xx > 1% for 5 min | Investigate logs |
| Disbursement failure | Any failed tx | Review immediately |
| Reconciliation divergence | inconsistent = true | Pause automated disbursements |
| Rate limit exhaustion | > 50 unique IPs/min hitting limit | Potential DDoS, review |
| Dead domain events | count > 10 | Investigate handler failures |
| KMS unavailable | decryptSecret throws | Block financial ops until resolved |
