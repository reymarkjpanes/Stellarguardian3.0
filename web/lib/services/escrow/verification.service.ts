import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import { writeAuditRecord } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notification";
import { queryEscrowState } from "@/lib/stellar/soroban-escrow";
import { isStateConsistent, describeStateDivergence } from "@/lib/stellar/escrow-state-map";
import { logger } from "@/lib/logger";
import type { EscrowState } from "@/types";

export class VerificationService {
  static async reconcileEscrow(
    eventId: string,
  ): Promise<{
    consistent: boolean;
    onChainBalance: string;
    expectedBalance: string;
    contractStateConsistent: boolean | null;
  }> {
    const stellar = getStellarClient();
    const supabase = createServiceClient();

    const { data: escrow } = await supabase
      .from("escrow_accounts")
      .select("*")
      .eq("event_id", eventId)
      .single();

    if (!escrow) throw new Error("Escrow account not found.");

    const onChainBalance = await stellar.getBalance(escrow.stellar_public_key);
    const balanceConsistent = onChainBalance === escrow.expected_balance;

    // --- Soroban contract state comparison (ADR-001) ---
    let contractStateConsistent: boolean | null = null;
    try {
      const contractState = await queryEscrowState();
      if (contractState) {
        contractStateConsistent = isStateConsistent(
          escrow.state as EscrowState,
          contractState.state,
        );

        if (!contractStateConsistent) {
          const divergence = describeStateDivergence(
            escrow.state as EscrowState,
            contractState.state,
          );
          logger.warn("[reconciliation] Contract state divergence detected", {
            eventId,
            divergence,
          });
        }
      }
    } catch (err) {
      // Soroban RPC may be unavailable — non-blocking for reconciliation
      logger.warn("[reconciliation] Soroban state query failed (non-blocking)", {
        eventId,
        error: String(err),
      });
    }

    const consistent = balanceConsistent && (contractStateConsistent !== false);

    if (!consistent) {
      await supabase
        .from("escrow_accounts")
        .update({
          inconsistent: true,
          last_reconciled_balance: onChainBalance,
        })
        .eq("id", escrow.id);

      const { data: event } = await supabase.from("events").select("organizer_id").eq("id", eventId).single();

      if (event) {
        await createNotification({
          userId: event.organizer_id,
          category: "escrow",
          title: "Escrow reconciliation issue detected",
          body: !balanceConsistent
            ? `On-chain balance (${onChainBalance}) does not match expected (${escrow.expected_balance}). Automated transitions are blocked.`
            : `Contract state divergence detected. The platform and on-chain contract show different lifecycle states.`,
          eventId,
        });
      }

      await writeAuditRecord({
        action: "escrow.reconciliation",
        actor_id: "system",
        event_id: eventId,
        resource_type: "escrow_accounts",
        resource_id: escrow.id,
        metadata: {
          onChainBalance,
          expectedBalance: escrow.expected_balance,
          balanceConsistent,
          contractStateConsistent,
          inconsistent: true,
        },
      });
    } else {
      await supabase
        .from("escrow_accounts")
        .update({ last_reconciled_balance: onChainBalance, inconsistent: false })
        .eq("id", escrow.id);
    }

    return { consistent, onChainBalance, expectedBalance: escrow.expected_balance, contractStateConsistent };
  }

  static async getEscrowVerification(eventId: string) {
    const stellar = getStellarClient();
    const supabase = createServiceClient();

    const { data: escrow } = await supabase
      .from("escrow_accounts")
      .select("stellar_public_key, state, expected_balance, last_reconciled_balance, inconsistent")
      .eq("event_id", eventId)
      .single();

    if (!escrow) return null;

    const onChainBalance = await stellar.getBalance(escrow.stellar_public_key);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("type, tx_hash, amount, status, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      publicKey: escrow.stellar_public_key,
      state: escrow.state,
      onChainBalance,
      expectedBalance: escrow.expected_balance,
      consistent: !escrow.inconsistent,
      transactions: (transactions ?? []).map((tx) => ({
        ...tx,
        explorerUrl: stellar.explorerUrl(tx.tx_hash),
      })),
    };
  }
}
