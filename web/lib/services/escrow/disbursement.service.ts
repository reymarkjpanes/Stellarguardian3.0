import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import { EscrowRepository } from "@/lib/repositories/escrow.repository";
import { publishDomainEvent } from "@/lib/events/publisher";
import { createNotification } from "@/lib/services/notification";
import { ValidationError } from "@/lib/errors";

const MAX_OPS_PER_TX = 100;

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

    if (totalAllocated > onChainBalance) {
      throw new ValidationError(
        "Prize allocation exceeds the confirmed on-chain escrow balance.",
        {
          onChainBalance: String(onChainBalance),
          attemptedTotal: String(totalAllocated),
          deficit: String(totalAllocated - onChainBalance),
        },
      );
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

    const verifiedPayments: Array<{ winnerId: string; recipientId: string; destination: string; amount: string }> = [];

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

    // Process payments via Stellar
    const successfulPayments: Array<{ winnerId: string; recipientId: string; destination: string; amount: string; txHash: string }> = [];
    
    for (let i = 0; i < verifiedPayments.length; i += MAX_OPS_PER_TX) {
      const batch = verifiedPayments.slice(i, i + MAX_OPS_PER_TX);
      const payments = batch.map((p) => ({ destination: p.destination, amount: p.amount }));

      try {
        const xdr = await stellar.buildPaymentBatch(escrow.stellar_public_key, payments);
        const { hash, successful } = await stellar.submitSignedTx(xdr);

        if (successful) {
          batch.forEach((p) => {
            successfulPayments.push({ ...p, txHash: hash });
            paid.push({ recipientId: p.recipientId, txHash: hash, amount: p.amount });
          });
        }
      } catch (error) {
        console.error("[escrow] Disbursement batch failed:", error);
        batch.forEach((p) => {
          held.push({ recipientId: p.recipientId, amount: p.amount, reason: "Batch transaction failed" });
        });
      }
    }

    // Persist via RPC
    if (successfulPayments.length > 0) {
      await EscrowRepository.disbursePrizes(eventId, escrow.id, successfulPayments, stellar.getNetworkMode());
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

    if (held.length > 0) {
      const { data: event } = await supabase.from("events").select("organizer_id").eq("id", eventId).single();
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
