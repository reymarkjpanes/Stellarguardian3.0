import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import { EscrowRepository } from "@/lib/repositories/escrow.repository";
import { publishDomainEvent } from "@/lib/events/publisher";
import { createNotification } from "@/lib/services/notification";
import { ValidationError } from "@/lib/errors";
import { decryptSecret } from "@/lib/services/kms";
import { logger } from "@/lib/logger";

const MAX_OPS_PER_TX = 100;

/**
 * Signs an unsigned transaction XDR with the escrow keypair.
 * SECURITY: Decrypts the escrow secret via KMS, signs in-process, never logs the key.
 */
async function signXdr(
  unsignedXdr: string,
  encryptedSecretKey: string,
  networkPassphrase: string,
): Promise<string> {
  const { Keypair, TransactionBuilder } = await import("@stellar/stellar-sdk");
  const secret = await decryptSecret(String(encryptedSecretKey));
  const keypair = Keypair.fromSecret(secret);
  const tx = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase);
  tx.sign(keypair);
  return tx.toXDR();
}

export class DisbursementService {
  static async validatePrizeAllocation(
    eventId: string,
    allocations: Array<{ recipientId: string; amount: string }>,
  ): Promise<void> {
    const stellar = getStellarClient();
    const supabase = createServiceClient();

    const { data: escrow } = await supabase
      .from("escrow_accounts")
      .select("stellar_public_key")
      .eq("event_id", eventId)
      .single();

    if (!escrow) throw new Error("Escrow account not found.");

    const onChainBalance = Number(await stellar.getBalance(escrow.stellar_public_key));
    const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amount), 0);

    // Stellar requires minimum account reserve (1 XLM base + fees per operation)
    const STELLAR_BASE_RESERVE = 1; // XLM
    const batchCount = Math.ceil(allocations.length / MAX_OPS_PER_TX);
    const estimatedFees = 0.00001 * allocations.length; // base fee per operation
    const minRetainedBalance = STELLAR_BASE_RESERVE + estimatedFees;
    const maxDisbursable = onChainBalance - minRetainedBalance;

    if (totalAllocated > maxDisbursable) {
      throw new ValidationError("Prize allocation exceeds the disbursable escrow balance after Stellar reserves.", {
        onChainBalance: String(onChainBalance),
        attemptedTotal: String(totalAllocated),
        stellarReserve: String(minRetainedBalance),
        maxDisbursable: String(maxDisbursable),
        deficit: String(totalAllocated - maxDisbursable),
        batchCount: String(batchCount),
      });
    }
  }

  static async executeDisbursement(
    eventId: string,
    actorId: string,
  ): Promise<{
    paid: Array<{ recipientId: string; txHash: string; amount: string }>;
    held: Array<{ recipientId: string; amount: string; reason: string }>;
  }> {
    const stellar = getStellarClient();
    const supabase = createServiceClient();

    // --- Acquire disbursement lock (C1: double-spend prevention) ---
    const { data: lockAcquired } = await supabase.rpc("begin_disbursement", {
      p_event_id: eventId,
      p_actor_id: actorId,
    });

    if (!lockAcquired) {
      throw new ValidationError(
        "Disbursement already in progress or escrow is not in a valid state for disbursement.",
        { eventId, hint: "Wait for the current disbursement to complete, or check escrow state." },
      );
    }

    try {
      return await this._executeDisbursementInner(eventId, actorId, stellar, supabase);
    } catch (error) {
      // Abort: revert escrow state on failure
      await supabase.rpc("abort_disbursement", { p_event_id: eventId });
      throw error;
    }
  }

  private static async _executeDisbursementInner(
    eventId: string,
    actorId: string,
    stellar: ReturnType<typeof getStellarClient>,
    supabase: ReturnType<typeof createServiceClient>,
  ): Promise<{
    paid: Array<{ recipientId: string; txHash: string; amount: string }>;
    held: Array<{ recipientId: string; amount: string; reason: string }>;
  }> {
    const { Networks } = await import("@stellar/stellar-sdk");
    const networkPassphrase =
      stellar.getNetworkMode() === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

    const { data: escrow } = await supabase
      .from("escrow_accounts")
      .select("*")
      .eq("event_id", eventId)
      .single();

    if (!escrow) throw new Error("Escrow account not found.");

    const { data: winners } = await supabase
      .from("winners")
      .select("id, recipient_id, prize_amount, disbursement_status")
      .eq("event_id", eventId)
      .eq("disbursement_status", "pending");

    if (!winners || winners.length === 0) {
      return { paid: [], held: [] };
    }

    const paid: Array<{ recipientId: string; txHash: string; amount: string }> = [];
    const held: Array<{ recipientId: string; amount: string; reason: string }> = [];

    const recipientIds = winners.map((w) => w.recipient_id);
    const { data: wallets } = await supabase
      .from("wallets")
      .select("user_id, public_key, verification_status")
      .in("user_id", recipientIds)
      .eq("verification_status", "Verified");

    const verifiedWalletMap = new Map((wallets ?? []).map((w) => [w.user_id, w.public_key]));

    const verifiedPayments: Array<{
      winnerId: string;
      recipientId: string;
      destination: string;
      amount: string;
    }> = [];

    for (const winner of winners) {
      const walletKey = verifiedWalletMap.get(winner.recipient_id);
      if (walletKey) {
        verifiedPayments.push({
          winnerId: winner.id,
          recipientId: winner.recipient_id,
          destination: walletKey,
          amount: String(winner.prize_amount),
        });
      } else {
        held.push({
          recipientId: winner.recipient_id,
          amount: String(winner.prize_amount),
          reason: "No verified wallet at disbursement time",
        });
      }
    }

    // Process payments via Stellar — build, sign with escrow key, submit (Task 0.2)
    const successfulPayments: Array<{
      winnerId: string;
      recipientId: string;
      destination: string;
      amount: string;
      txHash: string;
    }> = [];

    // Decrypt escrow key once — fail fast if KMS is unavailable (Task 0.2)
    let escrowSecret: string;
    try {
      escrowSecret = await decryptSecret(String(escrow.encrypted_secret_key));
    } catch (err) {
      logger.error("[disbursement] KMS decryption failed — cannot proceed", {
        eventId,
        error: String(err),
      });
      // Notify organizer and abort; do not mark winners as failed (retryable)
      const { data: event } = await supabase
        .from("events")
        .select("organizer_id")
        .eq("id", eventId)
        .single();
      if (event) {
        await createNotification({
          userId: event.organizer_id,
          category: "escrow",
          title: "Disbursement failed — KMS error",
          body: "Escrow key decryption failed. Contact platform support.",
          eventId,
        });
      }
      throw new Error("KMS decryption failed; disbursement aborted.");
    }

    for (let i = 0; i < verifiedPayments.length; i += MAX_OPS_PER_TX) {
      const batch = verifiedPayments.slice(i, i + MAX_OPS_PER_TX);
      const payments = batch.map((p) => ({ destination: p.destination, amount: p.amount }));

      try {
        // Build unsigned XDR
        const unsignedXdr = await stellar.buildPaymentBatch(escrow.stellar_public_key, payments);
        // Sign with the escrow keypair (Task 0.2 fix)
        const { Keypair, TransactionBuilder } = await import("@stellar/stellar-sdk");
        const keypair = Keypair.fromSecret(escrowSecret);
        const tx = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase);
        tx.sign(keypair);
        const signedXdr = tx.toXDR();

        const { hash, successful } = await stellar.submitSignedTx(signedXdr);

        if (successful) {
          batch.forEach((p) => {
            successfulPayments.push({ ...p, txHash: hash });
            paid.push({ recipientId: p.recipientId, txHash: hash, amount: p.amount });
          });
        } else {
          batch.forEach((p) => {
            held.push({
              recipientId: p.recipientId,
              amount: p.amount,
              reason: "Transaction submitted but not successful",
            });
          });
        }
      } catch (error) {
        logger.error("[escrow] Disbursement batch failed", { eventId, error: String(error) });
        batch.forEach((p) => {
          held.push({
            recipientId: p.recipientId,
            amount: p.amount,
            reason: "Batch transaction failed",
          });
        });
      }
    }

    // Persist via RPC
    if (successfulPayments.length > 0) {
      await EscrowRepository.disbursePrizes(
        eventId,
        escrow.id,
        successfulPayments,
        stellar.getNetworkMode(),
      );
    }

    // Update held winners
    for (const h of held) {
      await supabase
        .from("winners")
        .update({ disbursement_status: "held" })
        .eq("event_id", eventId)
        .eq("recipient_id", h.recipientId);
    }

    await publishDomainEvent({
      type: "PrizeReleased",
      eventId,
      escrowId: escrow.id,
      paidCount: paid.length,
      heldCount: held.length,
      actorId,
    });

    // --- Complete disbursement lock: transition escrow to Released ---
    if (paid.length > 0) {
      await supabase.rpc("complete_disbursement", {
        p_event_id: eventId,
        p_actor_id: actorId,
      });
    }

    if (held.length > 0) {
      const { data: event } = await supabase
        .from("events")
        .select("organizer_id")
        .eq("id", eventId)
        .single();
      if (event) {
        await createNotification({
          userId: event.organizer_id,
          category: "disbursement",
          title: "Some winners could not be paid",
          body: `${held.length} winner(s) do not have a verified wallet. Their allocation is held.`,
          eventId,
        });
      }
    }

    return { paid, held };
  }
}
