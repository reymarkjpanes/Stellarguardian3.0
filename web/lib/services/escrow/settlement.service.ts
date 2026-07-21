/**
 * SettlementService — records final escrow settlement (Task 3.2, Req 8.8).
 *
 * Called when escrow reaches a terminal state (Released or Refunded).
 * Computes the discrepancy between expected and actual paid amounts and
 * persists an immutable settlement record.
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { writeAuditRecord } from "@/lib/services/audit";
import { logger } from "@/lib/logger";

export interface Settlement {
  id: string;
  escrowId: string;
  payoutBatchId: string | null;
  totalFunded: number;
  totalDisbursed: number;
  discrepancy: number;
  settledAt: string;
  settledBy: string;
}

export class SettlementService {
  /**
   * Record the final settlement for an escrow account.
   * Computes funded vs. disbursed amounts from the transactions table and
   * inserts an immutable settlements record.
   */
  static async recordSettlement(escrowId: string, actorId: string): Promise<Settlement> {
    const supabase = createServiceClient();

    // 1. Fetch the escrow
    const { data: escrow, error: escrowErr } = await supabase
      .from("escrow_accounts")
      .select("id, event_id, state, expected_balance")
      .eq("id", escrowId)
      .single();

    if (escrowErr || !escrow) {
      throw new Error(`Escrow not found: ${escrowId}`);
    }

    // 2. Sum all fund transactions
    const { data: fundTxs } = await supabase
      .from("transactions")
      .select("amount")
      .eq("escrow_id", escrowId)
      .eq("type", "fund")
      .eq("status", "confirmed");

    const totalFunded = (fundTxs ?? []).reduce((sum, t) => sum + Number(t.amount), 0);

    // 3. Sum all disbursement transactions
    const { data: disburseTxs } = await supabase
      .from("transactions")
      .select("amount")
      .eq("escrow_id", escrowId)
      .eq("type", "disbursement")
      .eq("status", "confirmed");

    const totalDisbursed = (disburseTxs ?? []).reduce((sum, t) => sum + Number(t.amount), 0);

    const discrepancy = totalFunded - totalDisbursed;

    // 4. Look up the most recent payout batch (if any)
    const { data: batch } = await supabase
      .from("payout_batches")
      .select("id")
      .eq("escrow_id", escrowId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Insert immutable settlement record
    const { data: settlement, error: insertErr } = await supabase
      .from("settlements")
      .insert({
        escrow_id: escrowId,
        payout_batch_id: batch?.id ?? null,
        reconciled_amount: totalDisbursed,
        discrepancy_amount: discrepancy,
        settled_by: actorId,
        notes: `Auto-recorded on state=${escrow.state}. funded=${totalFunded}, disbursed=${totalDisbursed}`,
      })
      .select()
      .single();

    if (insertErr || !settlement) {
      throw new Error(`Failed to record settlement: ${insertErr?.message}`);
    }

    // 6. Audit record
    await writeAuditRecord({
      action: "escrow.settle",
      actor_id: actorId,
      event_id: escrow.event_id,
      resource_type: "escrow_accounts",
      resource_id: escrowId,
      metadata: { totalFunded, totalDisbursed, discrepancy },
    });

    if (Math.abs(discrepancy) > 0) {
      logger.warn("[settlement] Discrepancy detected", {
        escrowId,
        totalFunded,
        totalDisbursed,
        discrepancy,
      });
    }

    return {
      id: settlement.id,
      escrowId,
      payoutBatchId: batch?.id ?? null,
      totalFunded,
      totalDisbursed,
      discrepancy,
      settledAt: settlement.settled_at,
      settledBy: actorId,
    };
  }
}
