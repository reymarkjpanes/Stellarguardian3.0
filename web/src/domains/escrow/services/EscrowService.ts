import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase/database.types';
import { EscrowProvider, PayoutInstruction } from '../domain/EscrowProvider';

export class EscrowService {
  constructor(
    private supabase: SupabaseClient<Database>,
    private provider: EscrowProvider
  ) {}

  private log(operation: string, data: any) {
    // Structured logging for observability
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      domain: 'EscrowService',
      provider: this.provider.getIdentity().provider,
      operation,
      ...data
    }));
  }

  /**
   * Initializes a new Escrow Account for a finalized Prize Allocation Batch
   */
  async createEscrow(eventId: string, batchId: string, expectedBalance: number, userId: string) {
    const startTime = Date.now();
    try {
      const { address } = await this.provider.createEscrow();

      const { data: escrowId, error } = await this.supabase.rpc('create_escrow_account', {
        p_event_id: eventId,
        p_batch_id: batchId,
        p_expected_balance: expectedBalance,
        p_user_id: userId
      });

      if (error) throw new Error(`Failed to create escrow: ${error.message}`);

      await this.supabase
        .from('escrow_accounts')
        .update({ contract_address: address })
        .eq('id', escrowId);

      this.log('createEscrow', { success: true, durationMs: Date.now() - startTime, escrowId, address });
      return { escrowId, address };
    } catch (err: any) {
      this.log('createEscrow', { success: false, durationMs: Date.now() - startTime, error: err.message });
      throw err;
    }
  }

  /**
   * Verifies if funding has arrived and records it if it has.
   */
  async verifyFunding(escrowId: string) {
    const startTime = Date.now();
    try {
      const { data: escrow, error: fetchErr } = await this.supabase
        .from('escrow_accounts')
        .select('*')
        .eq('id', escrowId)
        .single();

      if (fetchErr || !escrow) throw new Error('Escrow not found');
      if (!escrow.contract_address) throw new Error('Escrow has no contract address');
      if (escrow.status === 'Funded' || escrow.status === 'Verified') {
         this.log('verifyFunding', { success: true, durationMs: Date.now() - startTime, escrowId, note: 'Already Funded/Verified' });
         return true;
      }

      const verification = await this.provider.verifyFunding(escrow.contract_address, escrow.expected_balance);
      
      if (verification) {
        const { error: rpcErr } = await this.supabase.rpc('record_funding_verification', {
          p_escrow_id: escrowId,
          p_amount: verification.amount,
          p_source_type: 'BlockchainDeposit',
          p_tx_hash: verification.txHash,
          p_block_height: verification.blockHeight,
          p_provider: verification.verifiedByProvider
        });

        if (rpcErr) throw new Error(`Failed to record funding: ${rpcErr.message}`);
        this.log('verifyFunding', { success: true, durationMs: Date.now() - startTime, escrowId, txHash: verification.txHash });
        return true;
      }

      this.log('verifyFunding', { success: true, durationMs: Date.now() - startTime, escrowId, note: 'Funding not found' });
      return false;
    } catch (err: any) {
      this.log('verifyFunding', { success: false, durationMs: Date.now() - startTime, escrowId, error: err.message });
      throw err;
    }
  }

  /**
   * Transitions a Funded escrow to Verified if all preconditions are met (e.g. KYC, time delays).
   */
  async markAsVerified(escrowId: string) {
    const { error } = await this.supabase
      .from('escrow_accounts')
      .update({ status: 'Verified' })
      .eq('id', escrowId)
      .eq('status', 'Funded');
      
    if (error) throw new Error(`Failed to mark verified: ${error.message}`);
  }

  /**
   * Generates a Payout Batch and the necessary Payout Instructions
   */
  async generatePayoutBatch(escrowId: string, userId: string, idempotencyKey: string) {
    const { data: batchId, error } = await this.supabase.rpc('generate_payout_batch', {
      p_escrow_id: escrowId,
      p_user_id: userId,
      p_idempotency_key: idempotencyKey
    });

    if (error) throw new Error(`Failed to generate payout batch: ${error.message}`);

    // Now we must map prize_allocations to payout_instructions
    // Fetch the prize allocation batch ID from the generated payout batch
    const { data: payoutBatch } = await this.supabase
      .from('payout_batches')
      .select('prize_allocation_batch_id')
      .eq('id', batchId)
      .single();

    if (!payoutBatch) throw new Error('Could not fetch new payout batch');

    // Get all allocations for this batch
    const { data: allocations } = await this.supabase
      .from('prize_allocations')
      .select('*')
      .eq('batch_id', payoutBatch.prize_allocation_batch_id);

    if (!allocations || allocations.length === 0) {
       throw new Error('No allocations found for this batch');
    }

    // Prepare instructions (for mock sake we assign dummy wallets if none exist on team)
    // Real implementation would look up team wallets.
    const instructionsToInsert = allocations.map(alloc => ({
      payout_batch_id: batchId,
      allocation_id: alloc.id,
      recipient_wallet: `G${Array.from({length:55},()=>'A').join('')}`, // Mock wallet
      amount: alloc.amount,
      currency: 'USD'
    }));

    const { error: insertErr } = await this.supabase
      .from('payout_instructions')
      .insert(instructionsToInsert);

    if (insertErr) throw new Error(`Failed to create payout instructions: ${insertErr.message}`);

    return batchId;
  }

  /**
   * Simulates the batch and returns the result.
   */
  async simulatePayoutBatch(batchId: string) {
    const { data: batch } = await this.supabase
      .from('payout_batches')
      .select('*, escrow_accounts(contract_address)')
      .eq('id', batchId)
      .single();

    if (!batch) throw new Error('Batch not found');
    
    const { data: instructionsData } = await this.supabase
      .from('payout_instructions')
      .select('*')
      .eq('payout_batch_id', batchId)
      .in('status', ['Pending', 'Retry']);
      
    if (!instructionsData || instructionsData.length === 0) {
      return { isValid: false, errors: ['No instructions to simulate'], estimatedFee: 0 };
    }

    const instructions: PayoutInstruction[] = instructionsData.map((i: any) => ({
      id: i.id,
      recipientWallet: i.recipient_wallet,
      amount: i.amount,
      currency: i.currency
    }));

    const escrowAddress = (batch.escrow_accounts as any).contract_address;
    return await this.provider.simulatePayoutBatch(escrowAddress, instructions);
  }

  /**
   * Submits the batch to the blockchain and marks as Broadcast.
   */
  async executePayoutBatch(batchId: string) {
    const startTime = Date.now();
    const { data: batch } = await this.supabase
      .from('payout_batches')
      .select('*, escrow_accounts(contract_address)')
      .eq('id', batchId)
      .single();

    if (!batch) throw new Error('Batch not found');
    if (batch.status !== 'Pending' && batch.status !== 'Failed' && batch.status !== 'Retried') {
       throw new Error(`Cannot execute batch in state ${batch.status}`);
    }
    
    // Get instructions
    const { data: instructionsData } = await this.supabase
      .from('payout_instructions')
      .select('*')
      .eq('payout_batch_id', batchId)
      .in('status', ['Pending', 'Retry']);
      
    if (!instructionsData || instructionsData.length === 0) {
        return; // Nothing to do
    }

    const instructions: PayoutInstruction[] = instructionsData.map(i => ({
      id: i.id,
      recipientWallet: i.recipient_wallet,
      amount: i.amount,
      currency: i.currency
    }));

    const idempotencyKey = batch.idempotency_key || batchId;
    const escrowAddress = (batch.escrow_accounts as any).contract_address;

    // 1. Simulation Phase
    await this.supabase.from('payout_batches').update({ status: 'Preparing' }).eq('id', batchId);
    try {
      const sim = await this.provider.simulatePayoutBatch(escrowAddress, instructions);
      if (!sim.isValid) {
        await this.supabase.from('payout_batches').update({ status: 'Failed' }).eq('id', batchId);
        this.log('executePayoutBatch', { success: false, phase: 'simulation', batchId, error: sim.errors });
        throw new Error(`Simulation failed: ${JSON.stringify(sim.errors)}`);
      }

      // Record simulated fees
      await this.supabase.from('payout_batches').update({
        fee_asset: this.provider.getIdentity().network === 'testnet' ? 'XLM (Testnet)' : 'XLM',
        network_fee: sim.estimatedFee,
        provider_fee: 0,
        total_fee: sim.estimatedFee,
        fee_payer: 'Organizer'
      }).eq('id', batchId);

    } catch (simErr: any) {
       await this.supabase.from('payout_batches').update({ status: 'Failed' }).eq('id', batchId);
       this.log('executePayoutBatch', { success: false, phase: 'simulation_error', batchId, error: simErr.message });
       throw simErr;
    }

    // 2. Execution Phase
    await this.supabase.from('payout_batches').update({ status: 'Broadcasting' }).eq('id', batchId);

    try {
      // Execute via provider
      const { txHash } = await this.provider.executePayoutBatch(escrowAddress, idempotencyKey, instructions);

      // We consider it 'Broadcast' - the exact success depends on instruction level updates and settlement later
      await this.supabase.from('payout_batches').update({ status: 'Broadcast' }).eq('id', batchId);
      
      // Update instructions
      for (const inst of instructions) {
        await this.supabase.rpc('update_payout_instruction_status', {
          p_instruction_id: inst.id,
          p_status: 'Broadcast',
          p_tx_hash: txHash
        });
      }

      this.log('executePayoutBatch', { success: true, durationMs: Date.now() - startTime, batchId, txHash, idempotencyKey });
      return txHash;
    } catch (err: any) {
      // Mark as Failed
      await this.supabase.from('payout_batches').update({ status: 'Failed' }).eq('id', batchId);
      for (const inst of instructions) {
         await this.supabase.rpc('update_payout_instruction_status', {
          p_instruction_id: inst.id,
          p_status: 'Failed',
          p_failure_reason: err.message
        });
      }
      this.log('executePayoutBatch', { success: false, durationMs: Date.now() - startTime, batchId, error: err.message });
      throw err;
    }
  }

  /**
   * Reconciles a payout batch and creates a Settlement.
   * Can be called manually or by a background cron job checking transaction statuses.
   */
  async reconcileSettlement(batchId: string, userId: string) {
    const startTime = Date.now();
    try {
      const { data: settlementId, error } = await this.supabase.rpc('reconcile_settlement', {
        p_batch_id: batchId,
        p_user_id: userId
      });

      if (error) {
        throw new Error(`Failed to reconcile: ${error.message}`);
      }

      // Check if there are failures, mark batch as Partially Completed if so, otherwise Completed
      const { data: instructions } = await this.supabase
        .from('payout_instructions')
        .select('status')
        .eq('payout_batch_id', batchId);
      
      if (instructions) {
        const hasFailures = instructions.some(i => i.status === 'Failed');
        const batchStatus = hasFailures ? 'Partially Completed' : 'Confirmed'; // Assuming confirmed if all good
        await this.supabase.from('payout_batches').update({ status: batchStatus }).eq('id', batchId);
      }

      this.log('reconcileSettlement', { success: true, durationMs: Date.now() - startTime, batchId, settlementId });
      return settlementId;
    } catch (err: any) {
      this.log('reconcileSettlement', { success: false, durationMs: Date.now() - startTime, batchId, error: err.message });
      throw err;
    }
  }
}
