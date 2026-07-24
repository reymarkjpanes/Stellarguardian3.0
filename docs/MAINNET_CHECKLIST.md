# Mainnet Deployment Checklist — Stellar Guardian 3.0

**DO NOT deploy to mainnet until ALL items are checked.**

## Pre-Mainnet Requirements

### Security
- [ ] Professional smart contract security audit completed (external firm)
- [ ] Penetration test on auth flows with zero critical findings
- [ ] Rate limiting active and verified (Upstash Redis connected)
- [ ] MFA enforcement works (AAL2 required for financial ops)
- [ ] CAPTCHA active on login/signup (Turnstile configured)
- [ ] All secrets rotated from testnet values
- [ ] KMS key is production-grade (not dev fallback)
- [ ] CSP, HSTS, X-Frame-Options all verified in production headers

### Financial Integrity
- [ ] Disbursement mutex tested under load (100 concurrent → only 1 succeeds)
- [ ] Retry logic verified (batch failure → retry → held if exhausted)
- [ ] Stellar reserve check prevents overdraft (1 XLM + fees retained)
- [ ] Financial precision confirmed: `numeric(20,7)` on all amount columns
- [ ] Fee accounting deducts base fee from balance calculations
- [ ] Reconciliation cron running and alerting on divergence
- [ ] Winner uniqueness constraint active (no duplicate allocations)
- [ ] Transaction signing verified end-to-end with real testnet funds

### Blockchain
- [ ] Updated Soroban contract deployed to mainnet
- [ ] Contract security audit passed (no critical findings)
- [ ] `admin_deposit()` tested for sponsor flow
- [ ] `disburse_batch()` + `finalize()` tested for multi-batch
- [ ] TTL refresh confirmed (contract won't expire during long escrows)
- [ ] `STELLAR_MAINNET_ENABLED=true` set
- [ ] Platform keypair funded with enough XLM for gas fees
- [ ] Testnet run completed end-to-end: fund → lock → disburse → finalize

### Testing
- [ ] All 431+ unit tests pass
- [ ] E2E flows pass on staging environment
- [ ] Load test: 100 concurrent users, p95 < 1s
- [ ] Financial flow tested with real testnet XLM (not mocked)
- [ ] Reconciliation verified: intentional imbalance → alert fires

### Infrastructure
- [ ] Production Supabase project (Pro plan, connection pooling enabled)
- [ ] Database backups configured and tested (restore works)
- [ ] Error tracking operational (Sentry or equivalent)
- [ ] Health endpoints reachable: `/api/health`, `/api/health/ready`
- [ ] All cron jobs scheduled and authenticated
- [ ] DNS + SSL configured for production domain
- [ ] CDN caching configured for static assets

### Documentation
- [ ] API documentation complete (all public endpoints)
- [ ] Deployment guide reviewed and tested
- [ ] Operational runbook covers: incident response, secret rotation, DB restore
- [ ] ADR-001 (Horizon/Soroban architecture) reviewed by team

### Business
- [ ] Terms of Service reviewed by legal
- [ ] Privacy Policy reviewed by legal
- [ ] KYC strategy decided (if required for jurisdiction)
- [ ] Dispute escalation path defined (who resolves if organizer won't?)
- [ ] Platform fee structure decided (if applicable)
- [ ] Support email / channel configured

## Go/No-Go Decision

| Criteria | Status |
|----------|--------|
| Zero critical security issues | ☐ |
| Financial double-spend test passes | ☐ |
| All user journeys verified | ☐ |
| Test coverage > 60% (financials > 90%) | ☐ |
| Monitoring active and alerting | ☐ |
| Documentation complete | ☐ |
| Smart contract audit passed | ☐ |
| Legal review complete | ☐ |

**All must be ☑ before mainnet activation.**

## Post-Launch Monitoring (First 48 Hours)

- Monitor error rate: alert if 5xx > 1%
- Monitor disbursement: any failure → immediate review
- Monitor reconciliation: any divergence → pause automated ops
- Monitor rate limits: spike in 429s → possible attack
- Keep rollback ready (previous deployment)
- Team on-call rotation active
