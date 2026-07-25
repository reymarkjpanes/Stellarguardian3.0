"use server";

import { createServerClient as createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { EscrowService } from "@/src/domains/escrow/services/EscrowService";
import { StellarEscrowAdapter } from "@/src/domains/escrow/adapters/StellarEscrowAdapter";
import { EnvKeyManager } from "@/src/domains/escrow/adapters/EnvKeyManager";

function getEscrowService() {
  const supabase = createServiceClient();
  const keyManager = new EnvKeyManager();
  const network = (process.env.STELLAR_NETWORK_MODE ?? "testnet") as "testnet" | "public";
  const adapter = new StellarEscrowAdapter(keyManager, network);
  return new EscrowService(supabase, adapter);
}

export async function createEscrowAction(
  eventId: string,
  batchId: string,
  expectedBalance: number,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const service = getEscrowService();
  return await service.createEscrow(eventId, batchId, expectedBalance, user.id);
}

export async function verifyFundingAction(escrowId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const service = getEscrowService();
  return await service.verifyFunding(escrowId);
}

export async function generatePayoutBatchAction(escrowId: string, batchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const service = getEscrowService();
  // Use batchId as the idempotency key for the payout batch generation
  return await service.generatePayoutBatch(escrowId, user.id, batchId);
}

export async function simulatePayoutBatchAction(batchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const service = getEscrowService();
  return await service.simulatePayoutBatch(batchId);
}

export async function releaseEscrowAction(batchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const service = getEscrowService();
  return await service.executePayoutBatch(batchId);
}

export async function reconcileSettlementAction(batchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const service = getEscrowService();
  return await service.reconcileSettlement(batchId, user.id);
}

export async function retryInstructionAction(instructionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Reset the instruction status to 'Retry' using service client for RLS bypass
  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from("payout_instructions")
    .update({ status: "Retry" })
    .eq("id", instructionId);

  if (error) throw new Error(`Failed to retry instruction: ${error.message}`);
  return true;
}
