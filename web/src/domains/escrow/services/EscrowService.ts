import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/supabase/database.types";
import { EscrowProvider, PayoutInstruction } from "../domain/EscrowProvider";

interface EscrowAccountRow {
  contract_address: string;
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

export class EscrowService {
  constructor(
    private supabase: SupabaseClient<Database>,
    private provider: EscrowProvider,
  ) {}

  private log(operation: string, data: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        domain: "EscrowService",
        provider: this.provider.getIdentity().provider,
        operation,
        ...data,
      }),
    );
  }

  async createEscrow(eventId: string, batchId: string, expectedBalance: number, userId: string) {
    const startTime = Date.now();
    try {
      const { address } = await this.provider.createEscrow();

      const { data: escrowId, error } = await this.supabase.rpc("create_escrow_account", {
        p_event_id: eventId,
        p_batch_id: batchId,
        p_expected_balance: expectedBalance,
        p_user_id: userId,
      });

      if (error) throw new Error(`Failed to create escrow: ${error.message}`);

      await this.supabase
        .from("escrow_accounts")
        .update({ contract_address: address })
        .eq("id", escrowId);

      this.log("createEscrow", {
        success: true,
        durationMs: Date.now() - startTime,
        escrowId,
        address,
      });
      return { escrowId, address };
    } catch (err) {
      this.log("createEscrow", {
        success: false,
        durationMs: Date.now() - startTime,
        error: toError(err).message,
      });
      throw err;
    }
  }

  async verifyFunding(escrowId: string) {
    const startTime = Date.now();
    try {
      const { data: escrow, error: fetchErr } = await this.supabase
        .from("escrow_accounts")
        .select("*")
        .eq("id", escrowId)
        .single();

      if (fetchErr || !escrow) throw new Error("Escrow not found");
      if (!escrow.contract_address) throw new Error("Escrow has no contract address");
      if (escrow.status === "Funded" || escrow.status === "Verified") {
        this.log("verifyFunding", {
          success: true,
          durationMs: Date.now() - startTime,
          escrowId,
          note: "Already Funded/Verified",
        });
        return true;
      }

      const verification = await this.provider.verifyFunding(
        escrow.contract_address,
        escrow.expected_balance,
      );

      if (verification) {
        const { error: rpcErr } = await this.supabase.rpc("record_funding_verification", {
          p_escrow_id: escrowId,
          p_amount: verification.amount,
          p_source_type: "BlockchainDeposit",
          p_tx_hash: verification.txHash,
          p_block_height: verification.blockHeight,
          p_provider: verification.verifiedByProvider,
        });

        if (rpcErr) throw new Error(`Failed to record funding: ${rpcErr.message}`);
        this.log("verifyFunding", {
          success: true,
          durationMs: Date.now() - startTime,
          escrowId,
          txHash: verification.txHash,
        });
        return true;
      }

      this.log("verifyFunding", {
        success: true,
        durationMs: Date.now() - startTime,
        escrowId,
        note: "Funding not found",
      });
      return false;
    } catch (err) {
      this.log("verifyFunding", {
        success: false,
        durationMs: Date.now() - startTime,
        escrowId,
        error: toError(err).message,
      });
      throw err;
    }
  }

  async markAsVerified(escrowId: string) {
    const { error } = await this.supabase
      .from("escrow_accounts")
      .update({ status: "Verified" })
      .eq("id", escrowId)
      .eq("status", "Funded");

    if (error) throw new Error(`Failed to mark verified: ${error.message}`);
  }

  async generatePayoutBatch(escrowId: string, userId: string, idempotencyKey: string) {
    const { data: batchId, error } = await this.supabase.rpc("generate_payout_batch", {
      p_escrow_id: escrowId,
      p_user_id: userId,
      p_idempotency_key: idempotencyKey,
    });

    if (error) throw new Error(`Failed to generate payout batch: ${error.message}`);

    const { data: payoutBatch } = await this.supabase
      .from("payout_batches")
      .select("prize_allocation_batch_id")
      .eq("id", batchId)
      .single();

    if (!payoutBatch) throw new Error("Could not fetch new payout batch");

    const { data: allocations } = await this.supabase
      .from("prize_allocations")
      .select("*")
      .eq("batch_id", payoutBatch.prize_allocation_batch_id);

    if (!allocations || allocations.length === 0) {
      throw new Error("No allocations found for this batch");
    }

    // Fetch all relevant submissions to determine ownership
    const submissionIds = allocations.map(a => a.submission_id);
    const { data: submissions } = await this.supabase
      .from("submissions")
      .select("id, team_id")
      .in("id", submissionIds);
      
    const ownerIdsToSubId = new Map<string, string>();
    const allOwnerIds = new Set<string>();
    
    if (submissions) {
      for (const sub of submissions) {
        allOwnerIds.add(sub.team_id);
        ownerIdsToSubId.set(sub.id, sub.team_id);
      }
    }

    // Fetch verified wallets
    const { data: wallets } = await this.supabase
      .from("wallet_verifications")
      .select("owner_id, wallet_address")
      .in("owner_id", Array.from(allOwnerIds))
      .eq("status", "Verified");
      
    const walletMap = new Map<string, string>();
    if (wallets) {
      for (const w of wallets) {
        walletMap.set(w.owner_id, w.wallet_address);
      }
    }

    const instructionsToInsert = allocations.map((alloc) => {
      const ownerId = ownerIdsToSubId.get(alloc.submission_id);
      const wallet = (ownerId && walletMap.get(ownerId)) || `G${Array.from({ length: 55 }, () => "A").join("")}`; // fallback
      
      return {
        payout_batch_id: batchId,
        allocation_id: alloc.id,
        recipient_wallet: wallet,
        amount: alloc.amount,
        currency: "USD",
      };
    });

    const { error: insertErr } = await this.supabase
      .from("payout_instructions")
      .insert(instructionsToInsert);

    if (insertErr) throw new Error(`Failed to create payout instructions: ${insertErr.message}`);

    return batchId;
  }

  async simulatePayoutBatch(batchId: string) {
    const { data: batch } = await this.supabase
      .from("payout_batches")
      .select("*, escrow_accounts(contract_address)")
      .eq("id", batchId)
      .single();

    if (!batch) throw new Error("Batch not found");

    const { data: instructionsData } = await this.supabase
      .from("payout_instructions")
      .select("*")
      .eq("payout_batch_id", batchId)
      .in("status", ["Pending", "Retry"]);

    if (!instructionsData || instructionsData.length === 0) {
      return { isValid: false, errors: "No instructions to simulate", estimatedFee: 0 };
    }

    const instructions: PayoutInstruction[] = instructionsData.map((i) => ({
      id: i.id,
      recipientWallet: i.recipient_wallet,
      amount: i.amount,
      currency: i.currency,
    }));

    const escrowAccounts = batch.escrow_accounts as EscrowAccountRow | EscrowAccountRow[] | null;
    const escrowAddress = Array.isArray(escrowAccounts)
      ? escrowAccounts[0]?.contract_address
      : escrowAccounts?.contract_address;

    if (!escrowAddress) throw new Error("Escrow account address not found");
    return await this.provider.simulatePayoutBatch(escrowAddress, instructions);
  }

  async executePayoutBatch(batchId: string) {
    const startTime = Date.now();
    const { data: batch } = await this.supabase
      .from("payout_batches")
      .select("*, escrow_accounts(contract_address)")
      .eq("id", batchId)
      .single();

    if (!batch) throw new Error("Batch not found");
    if (batch.status !== "Pending" && batch.status !== "Failed" && batch.status !== "Retried") {
      throw new Error(`Cannot execute batch in state ${batch.status}`);
    }

    const { data: instructionsData } = await this.supabase
      .from("payout_instructions")
      .select("*")
      .eq("payout_batch_id", batchId)
      .in("status", ["Pending", "Retry"]);

    if (!instructionsData || instructionsData.length === 0) {
      return;
    }

    const instructions: PayoutInstruction[] = instructionsData.map((i) => ({
      id: i.id,
      recipientWallet: i.recipient_wallet,
      amount: i.amount,
      currency: i.currency,
    }));

    const idempotencyKey = (batch.idempotency_key as string | null) ?? batchId;
    const escrowAccounts = batch.escrow_accounts as EscrowAccountRow | EscrowAccountRow[] | null;
    const escrowAddress = Array.isArray(escrowAccounts)
      ? escrowAccounts[0]?.contract_address
      : escrowAccounts?.contract_address;

    if (!escrowAddress) throw new Error("Escrow account address not found");

    await this.supabase.from("payout_batches").update({ status: "Preparing" }).eq("id", batchId);
    try {
      const sim = await this.provider.simulatePayoutBatch(escrowAddress, instructions);
      if (!sim.isValid) {
        await this.supabase.from("payout_batches").update({ status: "Failed" }).eq("id", batchId);
        this.log("executePayoutBatch", {
          success: false,
          phase: "simulation",
          batchId,
          error: sim.errors,
        });
        throw new Error(`Simulation failed: ${JSON.stringify(sim.errors)}`);
      }

      await this.supabase
        .from("payout_batches")
        .update({
          fee_asset: this.provider.getIdentity().network === "testnet" ? "XLM (Testnet)" : "XLM",
          network_fee: sim.estimatedFee,
          provider_fee: 0,
          total_fee: sim.estimatedFee,
          fee_payer: "Organizer",
        })
        .eq("id", batchId);
    } catch (simErr) {
      await this.supabase.from("payout_batches").update({ status: "Failed" }).eq("id", batchId);
      this.log("executePayoutBatch", {
        success: false,
        phase: "simulation_error",
        batchId,
        error: toError(simErr).message,
      });
      throw simErr;
    }

    await this.supabase.from("payout_batches").update({ status: "Broadcasting" }).eq("id", batchId);

    try {
      const { txHash } = await this.provider.executePayoutBatch(
        escrowAddress,
        idempotencyKey,
        instructions,
      );

      await this.supabase.from("payout_batches").update({ status: "Broadcast" }).eq("id", batchId);

      for (const inst of instructions) {
        await this.supabase.rpc("update_payout_instruction_status", {
          p_instruction_id: inst.id,
          p_status: "Broadcast",
          p_tx_hash: txHash,
        });
      }

      this.log("executePayoutBatch", {
        success: true,
        durationMs: Date.now() - startTime,
        batchId,
        txHash,
        idempotencyKey,
      });
      return txHash;
    } catch (err) {
      await this.supabase.from("payout_batches").update({ status: "Failed" }).eq("id", batchId);
      for (const inst of instructions) {
        await this.supabase.rpc("update_payout_instruction_status", {
          p_instruction_id: inst.id,
          p_status: "Failed",
          p_failure_reason: toError(err).message,
        });
      }
      this.log("executePayoutBatch", {
        success: false,
        durationMs: Date.now() - startTime,
        batchId,
        error: toError(err).message,
      });
      throw err;
    }
  }

  async reconcileSettlement(batchId: string, userId: string) {
    const startTime = Date.now();
    try {
      const { data: settlementId, error } = await this.supabase.rpc("reconcile_settlement", {
        p_batch_id: batchId,
        p_user_id: userId,
      });

      if (error) throw new Error(`Failed to reconcile: ${error.message}`);

      const { data: instructions } = await this.supabase
        .from("payout_instructions")
        .select("status")
        .eq("payout_batch_id", batchId);

      if (instructions) {
        const hasFailures = instructions.some((i) => i.status === "Failed");
        const batchStatus = hasFailures ? "Partially Completed" : "Confirmed";
        await this.supabase
          .from("payout_batches")
          .update({ status: batchStatus })
          .eq("id", batchId);
      }

      this.log("reconcileSettlement", {
        success: true,
        durationMs: Date.now() - startTime,
        batchId,
        settlementId,
      });
      return settlementId;
    } catch (err) {
      this.log("reconcileSettlement", {
        success: false,
        durationMs: Date.now() - startTime,
        batchId,
        error: toError(err).message,
      });
      throw err;
    }
  }
}
