import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import { writeAuditRecord } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notification";

const MAX_REFUND_RETRIES = 3;

export class RefundService {
  static async executeRefund(
    eventId: string,
    actorId: string,
  ): Promise<{ success: boolean; txHash?: string; attemptsUsed: number }> {
    const stellar = getStellarClient();
    const supabase = createServiceClient();

    const { data: escrow } = await supabase
      .from("escrow_accounts")
      .select("*")
      .eq("event_id", eventId)
      .single();

    if (!escrow) throw new Error("Escrow account not found.");
    if (!escrow.funding_wallet) throw new Error("No funding wallet recorded for refund destination.");

    const balance = await stellar.getBalance(escrow.stellar_public_key);
    if (Number(balance) <= 0) {
      return { success: true, attemptsUsed: 0 };
    }

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < MAX_REFUND_RETRIES) {
      attempt++;
      try {
        const xdr = await stellar.buildPaymentBatch(escrow.stellar_public_key, [
          { destination: escrow.funding_wallet, amount: balance },
        ]);
        const { hash, successful } = await stellar.submitSignedTx(xdr);

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
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    await supabase
      .from("escrow_accounts")
      .update({ state: "Failed", version: escrow.version + 1 })
      .eq("id", escrow.id);

    const { data: event } = await supabase.from("events").select("organizer_id").eq("id", eventId).single();

    if (event) {
      await createNotification({
        userId: event.organizer_id,
        category: "escrow",
        title: "Refund failed — manual intervention required",
        body: `Refund failed after ${MAX_REFUND_RETRIES} attempts. Escrow public key: ${escrow.stellar_public_key}`,
        eventId,
      });
    }

    console.error("[escrow] Refund exhausted retries:", lastError);
    return { success: false, attemptsUsed: attempt };
  }
}
