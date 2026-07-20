'use server';

import { createServerClient as createClient } from '@/lib/supabase/server';
import { EscrowService } from '@/src/domains/escrow/services/EscrowService';
import { StellarEscrowAdapter } from '@/src/domains/escrow/adapters/StellarEscrowAdapter';
import { EnvKeyManager } from '@/src/domains/escrow/adapters/EnvKeyManager';

function getEscrowService(supabase: any) {
  const keyManager = new EnvKeyManager();
  const adapter = new StellarEscrowAdapter(keyManager, 'testnet');
  return new EscrowService(supabase, adapter);
}

export async function createEscrowAction(eventId: string, batchId: string, expectedBalance: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const service = getEscrowService(supabase);
  return await service.createEscrow(eventId, batchId, expectedBalance, user.id);
}

export async function verifyFundingAction(escrowId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const service = getEscrowService(supabase);
  return await service.verifyFunding(escrowId);
}

export async function generatePayoutBatchAction(escrowId: string, batchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const service = getEscrowService(supabase);
  return await service.generatePayoutBatch(escrowId, batchId, user.id);
}

export async function simulatePayoutBatchAction(batchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const service = getEscrowService(supabase);
  return await service.simulatePayoutBatch(batchId);
}

export async function releaseEscrowAction(batchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const service = getEscrowService(supabase);
  return await service.executePayoutBatch(batchId);
}

export async function reconcileSettlementAction(batchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const service = getEscrowService(supabase);
  return await service.reconcileSettlement(batchId, user.id);
}

export async function retryInstructionAction(instructionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  // Quick fix: Since we don't have a direct service method for single retry yet,
  // we can reset the status and let the next executePayoutBatch pick it up, or implement it in service.
  // We'll update the instruction status to 'Retry'
  const { error } = await supabase
    .from('payout_instructions')
    .update({ status: 'Retry' })
    .eq('id', instructionId);

  if (error) throw new Error(`Failed to retry instruction: ${error.message}`);
  return true;
}
