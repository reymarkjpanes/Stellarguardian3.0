import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import { EscrowRepository } from "@/lib/repositories/escrow.repository";
import { publishDomainEvent } from "@/lib/events/publisher";
import { createNotification } from "@/lib/services/notification";
import { writeAuditRecord } from "@/lib/services/audit";
import { encryptSecret } from "@/lib/services/kms";

export class FundingService {
  static async createEscrowAccount(
    eventId: string,
    actorId: string,
  ): Promise<{ publicKey: string }> {
    const { Keypair } = await import("@stellar/stellar-sdk");
    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();

    const encryptedSecret = await encryptSecret(secretKey);

    const supabase = createServiceClient();
    const { error } = await supabase.from("escrow_accounts").insert({
      event_id: eventId,
      stellar_public_key: publicKey,
      encrypted_secret_key: encryptedSecret,
      state: "PendingFunding",
      expected_balance: "0",
      last_reconciled_balance: "0",
      version: 0,
    });

    if (error) throw new Error(`Failed to create escrow account: ${error.message}`);

    await writeAuditRecord({
      action: "escrow.fund",
      actor_id: actorId,
      event_id: eventId,
      resource_type: "escrow_accounts",
      metadata: { stellar_public_key: publicKey, action: "keypair_generated" },
    });

    return { publicKey };
  }

  static async verifyFunding(
    eventId: string,
    txHash: string,
    actorId: string,
    fundingWallet: string,
  ): Promise<{ confirmed: boolean; amount: string }> {
    const stellar = getStellarClient();
    const supabase = createServiceClient();

    const txStatus = await stellar.getTransaction(txHash);

    if (!txStatus || !txStatus.successful) {
      await createNotification({
        userId: actorId,
        category: "escrow",
        title: "Funding verification failed",
        body: "The funding transaction could not be confirmed on-chain. The event remains in Draft.",
        eventId,
      });
      return { confirmed: false, amount: "0" };
    }

    const { data: escrow } = await supabase
      .from("escrow_accounts")
      .select("id, stellar_public_key")
      .eq("event_id", eventId)
      .single();

    if (!escrow) throw new Error("Escrow account not found for event.");

    const balance = await stellar.getBalance(escrow.stellar_public_key);

    const result = await EscrowRepository.fundEscrow(
      eventId,
      txHash,
      actorId,
      fundingWallet,
      balance,
    );

    await publishDomainEvent({
      type: "FundingCompleted",
      eventId,
      escrowId: escrow.id,
      txHash,
      amount: result.amount,
      fundingWallet,
      newState: result.newState,
      actorId,
    });

    return { confirmed: true, amount: result.amount };
  }
}
