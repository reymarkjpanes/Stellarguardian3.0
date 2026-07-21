import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import { writeAuditRecord } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notification";
import { decryptSecret } from "@/lib/services/kms";
import { logger } from "@/lib/logger";

const MAX_REFUND_RETRIES = 3;

export class RefundService {
  static async executeRefund(
    eventId: string,
    actorId: string,
  ): Promise<{ success: boolean; txHash?: string; attemptsUsed: number }> {
    const stellar = getStellarClient();
    const supabase = createServiceClient();

    const { Networks } = await import("@stellar/stellar-sdk");
    const networkPassphrase =
      stellar.getNetworkMode() === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

    const { data: escrow } = await supabase
      .from("escrow_accounts")
      .select("*")
      .eq("event_id", eventId)
      .single();

    if (!escrow) throw new Error("Escrow account not found.");
    if (!escrow.funding_wallet)
      throw new Error("No funding wallet recorded for refund destination.");

    const balance = await stellar.getBalance(escrow.stellar_public_key);
    if (Number(balance) <= 0) {
      return { success: true, attemptsUsed: 0 };
    }

    // Decrypt escrow key once — fail fast if KMS unavailable (Task 0.2)
    let escrowSecret: string;
    try {
      escrowSecret = await decryptSecret(String(escrow.encrypted_secret_key));
    } catch (err) {
      logger.error("[refund] KMS decryption failed — cannot proceed", {
        eventId,
        error: String(err),
      });
      const { data: event } = await supabase
        .from("events")
        .select("organizer_id")
        .eq("id", eventId)
        .single();
      if (event) {
        await createNotification({
          userId: event.organizer_id,
          category: "escrow",
          title: "Refund failed — KMS error",
          body: "Escrow key decryption failed. Contact platform support.",
          eventId,
        });
      }
      throw new Error("KMS decryption failed; refund aborted.");
    }

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < MAX_REFUND_RETRIES) {
      attempt++;
      try {
        // Build unsigned XDR then sign with escrow keypair (Task 0.2 fix)
        const unsignedXdr = await stellar.buildPaymentBatch(escrow.stellar_public_key, [
          { destination: escrow.funding_wallet, amount: balance },
        ]);
        const { Keypair, TransactionBuilder } = await import("@stellar/stellar-sdk");
        const keypair = Keypair.fromSecret(escrowSecret);
        const tx = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase);
        tx.sign(keypair);
        const signedXdr = tx.toXDR();

        const { hash, successful } = await stellar.submitSignedTx(signedXdr);

        if (successful) {
          await supabase
            .from("escrow_accounts")
            .update({ state: "Refunded", version: escrow.version + 1 })
            .eq("id", escrow.id);

          await supabase.from("transactions").insert({
            event_id: eventId,
            escrow_id: escrow.id,
            type: "refund",
            tx_hash: hash,
            amount: balance,
            from_address: escrow.stellar_public_key,
            to_address: escrow.funding_wallet,
            status: "confirmed",
            network_mode: stellar.getNetworkMode(),
          });

          await writeAuditRecord({
            action: "escrow.refund",
            actor_id: actorId,
            event_id: eventId,
            resource_type: "escrow_accounts",
            resource_id: escrow.id,
            tx_hash: hash,
            wallet_address: escrow.funding_wallet,
            amount: balance,
            on_chain_status: "confirmed",
          });

          return { success: true, txHash: hash, attemptsUsed: attempt };
        }
      } catch (error) {
        lastError = error;
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    await supabase
      .from("escrow_accounts")
      .update({ state: "Failed", version: escrow.version + 1 })
      .eq("id", escrow.id);

    const { data: event } = await supabase
      .from("events")
      .select("organizer_id")
      .eq("id", eventId)
      .single();

    if (event) {
      await createNotification({
        userId: event.organizer_id,
        category: "escrow",
        title: "Refund failed — manual intervention required",
        body: `Refund failed after ${MAX_REFUND_RETRIES} attempts. Escrow public key: ${escrow.stellar_public_key}`,
        eventId,
      });
    }

    logger.error("[escrow] Refund exhausted retries", { eventId, error: String(lastError) });
    return { success: false, attemptsUsed: attempt };
  }
}
