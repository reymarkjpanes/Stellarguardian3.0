import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { EscrowState } from "@/types";

export class EscrowRepository {
  static async fundEscrow(
    eventId: string,
    txHash: string,
    actorId: string,
    fundingWallet: string,
    amount: string
  ): Promise<{ success: boolean; newState: EscrowState; amount: string }> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("fund_escrow", {
      p_event_id: eventId,
      p_tx_hash: txHash,
      p_actor_id: actorId,
      p_funding_wallet: fundingWallet,
      p_amount: Number(amount)
    });
    
    if (error) {
      if (error.message.includes("Escrow account not found")) {
        throw new Error("ESCROW_NOT_FOUND");
      }
      throw error;
    }
    return {
      success: data.success,
      newState: data.new_state as EscrowState,
      amount: String(data.amount)
    };
  }

  static async disbursePrizes(
    eventId: string,
    escrowId: string,
    payments: Array<{ winnerId: string; recipientId: string; destination: string; amount: string; txHash: string }>,
    networkMode: string
  ): Promise<boolean> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase.rpc("disburse_prizes", {
      p_event_id: eventId,
      p_escrow_id: escrowId,
      p_payments: payments,
      p_network_mode: networkMode
    });

    if (error) throw error;
    return data as boolean;
  }
}
