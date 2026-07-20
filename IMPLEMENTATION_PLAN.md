# StellarGuardian 3.0 — Complete Implementation Plan

## Overview

This document is the single-source execution plan to take StellarGuardian 3.0 from its
current state (42/100 readiness) to production-ready (85+/100). It is organized into
**6 Phases**, each containing numbered tasks with exact file paths, code changes needed,
acceptance criteria, and dependency ordering.

**Estimated Total Effort**: 10-13 weeks (1 senior engineer full-time, or 5-6 weeks with 2 engineers)

---

## Phase 0: Critical Blockers (Week 1)
*These 6 items MUST be fixed before any other work. They represent data loss, security,
or complete feature breakage risks.*


### Task 0.1: Fix Escrow Secret Key Encryption
**Priority**: 🔴 CRITICAL | **Effort**: 2 hours | **Dependencies**: None

**Problem**: `FundingService.createEscrowAccount()` stores the secret key as plain Base64.
If the database is compromised, all escrow funds are immediately stealable.

**File**: `web/lib/services/escrow/funding.service.ts`

**Change**:
```typescript
// BEFORE (INSECURE):
const encryptedSecret = Buffer.from(secretKey).toString("base64");

// AFTER (SECURE):
import { encryptSecret } from "@/lib/services/kms";
const encryptedSecret = await encryptSecret(secretKey);
```

**Acceptance Criteria**:
- [ ] `createEscrowAccount` calls `encryptSecret()` from KMS service
- [ ] Stored value starts with `kms:` (prod) or `aes:` (dev)
- [ ] Unit test verifies encrypted output is NOT plain Base64
- [ ] Existing escrow accounts with Base64 keys have a migration script

---

### Task 0.2: Fix Transaction Signing in Disbursement
**Priority**: 🔴 CRITICAL | **Effort**: 4 hours | **Dependencies**: Task 0.1

**Problem**: `DisbursementService` builds unsigned XDR then submits it. Stellar rejects
unsigned transactions. All disbursements fail silently.

**File**: `web/lib/services/escrow/disbursement.service.ts`

**Change**: After `buildPaymentBatch`, decrypt the escrow key and sign before submission.

```typescript
// Add to DisbursementService.executeDisbursement():
import { decryptSecret } from "@/lib/services/kms";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

// After buildPaymentBatch returns unsigned XDR:
const escrowSecret = await decryptSecret(escrow.encrypted_secret_key.toString());
const keypair = Keypair.fromSecret(escrowSecret);
const networkPassphrase = stellar.getNetworkMode() === "mainnet"
  ? "Public Global Stellar Network ; September 2015"
  : "Test SDF Network ; September 2015";
const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
tx.sign(keypair);
const signedXdr = tx.toXDR();
const { hash, successful } = await stellar.submitSignedTx(signedXdr);
```

**Also fix in**: `web/lib/services/escrow/refund.service.ts` (same pattern)

**Acceptance Criteria**:
- [ ] Disbursement signs XDR with decrypted escrow keypair before submission
- [ ] Refund signs XDR with decrypted escrow keypair before submission
- [ ] Integration test mocks Stellar and verifies signed XDR is submitted
- [ ] Error handling covers KMS decryption failure (notify admin, don't proceed)

---

