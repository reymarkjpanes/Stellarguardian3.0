## 2026-08-01T07:25:33Z

<USER_REQUEST>
You are teamwork_preview_worker for Milestone R3: Automated Escrow Trigger.
Your working directory is: c:\Users\Reymark\Documents\Antigravity-Project\stellar-guardian-3.0\.agents\worker_r3_escrow

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Objective:
Implement Requirement 3: Automated Escrow Trigger in Stellar Guardian 3.0.

Requirements & Acceptance Criteria:
- Reaching the `PrizeApproved` state automatically invokes Soroban smart contract payout logic without manual platform intervention.

Code Changes to Make in `web/`:
1. `web/app/api/cron/escrow/route.ts` & `web/app/api/webhooks/escrow-trigger/route.ts` (update/create):
   - Automatically detect events in `PrizeApproved` state.
   - Check zero open/under-review disputes exist in `disputes` table.
   - Verify `escrow_accounts.state === 'FullyFunded'`.
   - Acquire optimistic DB lock on `events.version` updating state to `EscrowRelease`.
   - Automatically invoke Soroban payout functions from `web/lib/stellar/soroban-escrow.ts`:
     a. `lockEscrow()`
     b. `executeSorobanDisbursementBatch()`
     c. `finalizeDisbursement()`
   - Record Soroban transaction hashes (`tx_hash`) into `payout_instructions` table.
   - Idempotency protection: ensure repeated triggers do not duplicate contract calls or instructions.
   - Secure route with `CRON_SECRET` / `WEBHOOK_SECRET` authorization check.
2. `web/lib/__tests__/r3-escrow-trigger-tier1-2.test.ts` (verify/update):
   - Ensure escrow automation unit & integration tests pass cleanly.

Verification:
- Run typecheck: `npm --prefix web run typecheck`
- Run tests: `npm --prefix web run test -- lib/__tests__/r3-escrow-trigger-tier1-2.test.ts`

Deliverables:
- Clean implementation in `web/`.
- Write `handoff.md` in your working directory with build/test results, observations, logic chain, caveats, conclusion, and verification commands.
- Send completion message to parent (ID: 7739df64-679a-4efb-bee3-42d08a61ccfd).
</USER_REQUEST>
