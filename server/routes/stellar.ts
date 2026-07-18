/**
 * server/routes/stellar.ts
 * Stellar escrow and transaction endpoints.
 * Phase 4 implementation: Real Testnet escrow via @stellar/stellar-sdk.
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '../middleware/errorHandler';
import db from '../db/client';
import {
  fundEventEscrow,
  verifyTransaction,
  getAccountBalance,
  disbursePrize,
} from '../services/stellarService';

export const stellarRouter = Router();

/**
 * POST /api/stellar/fund-event
 * Creates a real Stellar Testnet escrow account and funds it.
 * Requires: authenticated host, wallet connected.
 */
stellarRouter.post('/fund-event', authenticate, asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) throw new ApiError(400, 'eventId is required.', 'MISSING_FIELD');

  const event = db
    .prepare('SELECT id, hostUserId, prizeTotal, state, fundingTxRef FROM events WHERE id = ?')
    .get(eventId) as any;

  if (!event) throw new ApiError(404, 'Event not found.', 'NOT_FOUND');
  if (event.hostUserId !== req.user!.id) {
    throw new ApiError(403, 'Only the event host can fund this event.', 'FORBIDDEN');
  }
  if (event.state !== 'Draft') {
    throw new ApiError(422, `Event is already in state '${event.state}'. Only Draft events can be funded.`, 'INVALID_STATE');
  }

  const host = db.prepare('SELECT walletAddress FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!host?.walletAddress) {
    throw new ApiError(400, 'Please connect your Stellar wallet before funding.', 'WALLET_REQUIRED');
  }

  try {
    const result = await fundEventEscrow(String(event.prizeTotal), event.id);

    // Store escrow details on the event record
    db.transaction(() => {
      db.prepare(
        "UPDATE events SET state = 'Funded', fundingTxRef = ?, escrowPublicKey = ?, encryptedEscrowSecret = ? WHERE id = ?",
      ).run(result.txHash, result.escrowPublicKey, result.encryptedEscrowSecret, event.id);

      db.prepare(
        "INSERT INTO transactions (eventId, type, amountXLM, fromWallet, toWallet, txRef) VALUES (?, 'fund', ?, ?, ?, ?)",
      ).run(event.id, event.prizeTotal, host.walletAddress, result.escrowPublicKey, result.txHash);
    })();

    res.json({
      data: {
        txHash: result.txHash,
        escrowPublicKey: result.escrowPublicKey,
        explorerUrl: result.explorerUrl,
        state: 'Funded',
      },
    });
  } catch (err: any) {
    // Stellar SDK errors have a `response.data` with details
    const stellarError = err?.response?.data?.extras?.result_codes;
    if (stellarError) {
      throw new ApiError(
        400,
        `Stellar transaction failed: ${JSON.stringify(stellarError)}`,
        'STELLAR_TX_FAILED',
      );
    }
    throw err;
  }
}));

/**
 * GET /api/stellar/verify-tx/:txHash
 * Verify that a transaction hash exists on the Stellar network.
 */
stellarRouter.get('/verify-tx/:txHash', asyncHandler(async (req, res) => {
  const { txHash } = req.params;
  if (!txHash || !/^[a-f0-9]{64}$/i.test(txHash)) {
    throw new ApiError(400, 'Invalid transaction hash format.', 'INVALID_TX_HASH');
  }
  const exists = await verifyTransaction(txHash);
  res.json({ data: { txHash, verified: exists } });
}));

/**
 * GET /api/stellar/escrow/:eventId
 * Get escrow account balance and transaction history for an event.
 */
stellarRouter.get('/escrow/:eventId', authenticate, asyncHandler(async (req, res) => {
  const event = db
    .prepare('SELECT hostUserId, escrowPublicKey, prizeTotal FROM events WHERE id = ?')
    .get(req.params.eventId) as any;

  if (!event) throw new ApiError(404, 'Event not found.', 'NOT_FOUND');
  if (event.hostUserId !== req.user!.id) {
    throw new ApiError(403, 'Only the host can view escrow details.', 'FORBIDDEN');
  }

  const balance = event.escrowPublicKey
    ? await getAccountBalance(event.escrowPublicKey)
    : null;

  const transactions = db
    .prepare('SELECT * FROM transactions WHERE eventId = ? ORDER BY timestamp DESC')
    .all(req.params.eventId);

  res.json({
    data: {
      escrowPublicKey: event.escrowPublicKey,
      balance,
      prizeTotal: event.prizeTotal,
      transactions,
    },
  });
}));

/**
 * POST /api/stellar/payout
 * Disburse prize from escrow to winner's wallet.
 * Host only. Event must be in Completed state.
 */
stellarRouter.post('/payout', authenticate, asyncHandler(async (req, res) => {
  const { eventId, winnerId } = req.body;
  if (!eventId || !winnerId) {
    throw new ApiError(400, 'eventId and winnerId are required.', 'MISSING_FIELDS');
  }

  const event = db
    .prepare('SELECT hostUserId, state, encryptedEscrowSecret FROM events WHERE id = ?')
    .get(eventId) as any;

  if (!event) throw new ApiError(404, 'Event not found.', 'NOT_FOUND');
  if (event.hostUserId !== req.user!.id) {
    throw new ApiError(403, 'Only the host can initiate payouts.', 'FORBIDDEN');
  }
  if (event.state !== 'Completed') {
    throw new ApiError(400, 'Event must be in Completed state to initiate payout.', 'INVALID_STATE');
  }
  if (!event.encryptedEscrowSecret) {
    throw new ApiError(400, 'No escrow account found for this event.', 'NO_ESCROW');
  }

  const winner = db
    .prepare(`
      SELECT w.id, w.rank, w.prizeAmount, w.payoutTxRef, u.walletAddress, u.name
      FROM winners w
      JOIN submissions s ON w.submissionId = s.id
      JOIN users u ON s.userId = u.id
      WHERE w.id = ? AND w.eventId = ?
    `)
    .get(winnerId, eventId) as any;

  if (!winner) throw new ApiError(404, 'Winner not found.', 'NOT_FOUND');
  if (winner.payoutTxRef) {
    throw new ApiError(409, 'This winner has already been paid out.', 'ALREADY_PAID');
  }
  if (!winner.walletAddress) {
    throw new ApiError(400, `Winner ${winner.name} has not connected a Stellar wallet.`, 'WINNER_NO_WALLET');
  }

  const amount = winner.prizeAmount?.toString();
  if (!amount) throw new ApiError(400, 'No prize amount set for this winner.', 'NO_PRIZE_AMOUNT');

  const { txHash, explorerUrl } = await disbursePrize(
    event.encryptedEscrowSecret,
    winner.walletAddress,
    amount,
  );

  db.transaction(() => {
    db.prepare('UPDATE winners SET payoutTxRef = ? WHERE id = ?').run(txHash, winner.id);
    db.prepare(
      "INSERT INTO transactions (eventId, type, amountXLM, fromWallet, toWallet, txRef) VALUES (?, 'payout', ?, ?, ?, ?)",
    ).run(eventId, parseFloat(amount), 'ESCROW', winner.walletAddress, txHash);
  })();

  res.json({ data: { txHash, explorerUrl, winnerId: winner.id, amount } });
}));
