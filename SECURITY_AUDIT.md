# Security Audit — StellarGuardian 3.0

## 1. Critical Security Findings

### 🔴 CRITICAL: Secret Key Storage in FundingService

```typescript
// lib/services/escrow/funding.service.ts
const encryptedSecret = Buffer.from(secretKey).toString("base64");
```

**Issue**: `createEscrowAccount` stores the escrow secret key as plain Base64 encoding, NOT KMS envelope encryption. The `encryptSecret()` function from `lib/services/kms.ts` exists but is NOT called here.

**Impact**: If the database is compromised, all escrow secret keys are trivially recoverable (Base64 decode).

**Fix**: Replace with `await encryptSecret(secretKey)` and store the result.

---

### 🔴 CRITICAL: Escrow Transaction Signing Gap

**Issue**: `DisbursementService.executeDisbursement()` calls `stellar.buildPaymentBatch()` which returns unsigned XDR, then immediately calls `stellar.submitSignedTx(xdr)` — but the XDR was never signed with the escrow keypair.

The `buildPaymentBatch` method in `StellarChainAdapter` builds the transaction but only returns `tx.toXDR()` without signing. The `submitSignedTx` expects a signed XDR. This will fail at runtime with "transaction has no signatures."

**Impact**: All prize disbursements will fail on-chain.

**Fix**: After building, decrypt the escrow secret key via KMS and sign the XDR before submission.

---

### 🟠 HIGH: Permission Engine Incomplete

The `PermissionEngine` in `lib/engines/permission/permission-engine.ts` only defines rules for 3 of 10 roles:
- `PlatformAdmin` (Events.update only)
- `Organizer` (Events.update only)
- `Judge` (Submissions.read + evaluate)

Missing roles with no permissions defined: `WorkspaceOwner`, `WorkspaceAdmin`, `Sponsor`, `Mentor`, `Participant`, `TeamCaptain`, `TeamMember`.

**Impact**: `PermissionEngine.can()` returns `false` for all actions by these roles, but the fallback `lib/auth/permissions.ts` (`requireEventRole`, `requireWorkspaceRole`) uses a different matrix that does allow them. Two competing auth systems create confusion and potential bypass paths.

---

## 2. Authentication Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| Session management | ✅ Good | Supabase JWT + `@supabase/ssr` cookie persistence |
| Token refresh | ✅ Good | Middleware calls `getClaims()` immediately after client creation |
| Password auth | ✅ Good | Delegated to Supabase Auth (bcrypt, rate limited) |
| Wallet auth (challenge-response) | ✅ Good | 5-min nonce expiry, server-side verification |
| MFA / 2FA | ❌ Missing | Not implemented (should be required for financial operations) |
| Session invalidation | ⚠️ Partial | Supabase handles token expiry but no manual session revocation |
| CSRF protection | ✅ Good | Cookie-based auth with SameSite; CSP form-action restricted |

---

## 3. Authorization Assessment

### Dual Authorization Systems (Risk)

| System | Location | Coverage |
|--------|----------|----------|
| `lib/auth/permissions.ts` | Route handlers | Full role matrix for workspace/event roles |
| `lib/engines/permission/permission-engine.ts` | ABAC engine | Only 3 roles defined |
| Supabase RLS | Database layer | Comprehensive policies on all tables |

**Risk**: Route handlers may use either system inconsistently. No enforcement that both agree.

### RLS Policy Quality

- ✅ All 24 tables have RLS enabled
- ✅ `(select auth.uid())` used for planner caching (Supabase best practice)
- ✅ Escrow accounts: no insert/update/delete via RLS (service-role only)
- ✅ Audit records: immutable triggers block UPDATE/DELETE
- ✅ Judge/Participant mutual exclusion enforced at DB level
- ⚠️ `escrows_select` in Module 8 migration uses `USING (true)` — reads are public (may be intentional for transparency but exposes internal escrow state)
- ⚠️ `payout_instructions_select` uses `USING (true)` — exposes recipient wallet addresses publicly

---

## 4. Input Validation

| Layer | Mechanism | Coverage |
|-------|-----------|----------|
| API routes | Zod schemas via `apiHandler` | ✅ All POST/PUT/PATCH routes validated |
| Database | CHECK constraints | ✅ Enum values, string lengths, numeric ranges |
| Stellar addresses | Regex `^G[A-Z2-7]{55}$` | ✅ At DB and Zod level |
| File uploads | `file-validation.test.ts` exists | ⚠️ Implementation needs verification |
| Query params | Zod via `apiHandler` GET parsing | ✅ |

### Missing Validation

1. **No rate limiting on wallet challenge endpoint** — could be brute-forced (the 5-min expiry helps but doesn't prevent enumeration)
2. **No input size limits** — `description` allows 10,000 chars but no request body size limit in middleware
3. **No JSON depth limit** — deeply nested JSON in `resubmission_policy` or `file_policy` could cause parsing DoS

---

## 5. Secrets Management

| Secret | Storage | Status |
|--------|---------|--------|
| Supabase URL / Anon Key | `.env.local` | ✅ Not committed (in .gitignore) |
| Supabase Service Role Key | `.env.local` | ✅ Server-only via `server-only` import |
| Stellar escrow secret keys | Database (should be KMS-encrypted) | 🔴 Stored as Base64 (see Finding #1) |
| AWS KMS Key ARN | `.env.local` | ✅ |
| Upstash Redis tokens | `.env.local` | ✅ |
| Resend API key | `.env.local` | ✅ |
| `LOCAL_ENCRYPTION_KEY` | `.env.local` (dev fallback) | ⚠️ Hardcoded default in kms.ts |
| Soroban contract ID | `.env.local` | ✅ |

### Issues

1. 🟠 `kms.ts` has a hardcoded default: `"dev-only-key-never-use-in-production-32b"` — if `LOCAL_ENCRYPTION_KEY` is unset in prod and `KMS_KEY_ARN` is also unset, the guard throws, which is correct. But in dev, this default is predictable.
2. 🟡 Legacy XOR decryption support still exists in `kms.ts` — should be removed after migration.

---

## 6. Security Headers

| Header | Present | Value |
|--------|---------|-------|
| Content-Security-Policy | ✅ | Per-request nonce, strict-dynamic in prod |
| Strict-Transport-Security | ✅ | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | ✅ | `nosniff` |
| X-Frame-Options | ✅ | `DENY` |
| Referrer-Policy | ✅ | `strict-origin-when-cross-origin` |
| Permissions-Policy | ✅ | `camera=(), microphone=(), geolocation=()` |
| X-Request-Id | ✅ | UUID per request |

✅ Excellent security header configuration.

---

## 7. Rate Limiting

| Tier | Limit | Window | Mechanism |
|------|-------|--------|-----------|
| Auth | 10 | 15 min | Upstash Redis (LRU fallback) |
| Financial | 5 | 15 min | Upstash Redis (LRU fallback) |
| Events (create) | 10 | 24 hr | Upstash Redis (LRU fallback) |
| Default | 200 | 15 min | Upstash Redis (LRU fallback) |

### Issues

1. 🟡 Rate limiting is per-IP only — authenticated users sharing an IP (corporate NAT) will be collectively rate-limited
2. 🟡 In-memory fallback (when Redis is unavailable) is per-instance — not effective in multi-instance deployments
3. 🟡 No rate limit on the `signMessage` wallet challenge flow

---

## 8. Blockchain Security

| Aspect | Status | Notes |
|--------|--------|-------|
| Network mode enforcement | ✅ | `guardMainnet()` blocks mainnet ops unless `STELLAR_MAINNET_ENABLED=true` |
| Cross-network prevention | ✅ | `guardCrossNetwork()` validates network passphrase |
| Transaction verification | ✅ | On-chain tx confirmed before state change |
| Keypair verification (wallet) | ✅ | `Keypair.verify()` with challenge-response |
| Escrow key custody | 🔴 | Secret stored as Base64, not KMS-encrypted |
| Transaction signing | 🔴 | Disbursement XDR never signed before submission |
| Replay protection | ✅ | Idempotency keys prevent duplicate financial operations |

---

## 9. Workspace Isolation

| Isolation Mechanism | Status |
|--------------------|--------|
| RLS policies scope queries to workspace members | ✅ |
| Events belong to exactly one workspace (FK) | ✅ |
| Workspace members table with role-based access | ✅ |
| No cross-workspace data leakage in API responses | ⚠️ Not verified at API layer |
| Feature flags per workspace | ✅ (schema exists) |

---

## 10. Recommendations

### Immediate (Before Any Production Deployment)

1. **Fix secret key encryption** — Call `encryptSecret()` in `FundingService.createEscrowAccount()`
2. **Fix transaction signing** — Decrypt escrow key and sign XDR before submission in `DisbursementService`
3. **Remove legacy XOR decryption** — Migrate any existing data and drop the code path
4. **Consolidate authorization** — Pick one system (ABAC engine or role matrix) and use it everywhere
5. **Add MFA requirement** — For financial operations (fund, disburse, refund)

### Short-Term

6. **Add request body size limits** — Middleware should reject bodies > 1MB
7. **Per-user rate limiting** — Combine IP + user ID for authenticated routes
8. **Restrict escrow account SELECT policies** — Module 8's `USING (true)` is too permissive
9. **Add SQL injection audit** — Verify all Supabase queries use parameterized calls (they should via the client, but RPC calls pass user input)
10. **Implement session revocation** — Allow users to invalidate all sessions on password change
