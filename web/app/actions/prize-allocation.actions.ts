"use server";

import { createServerClient as createClient } from "@/lib/supabase/server";
import { AllocationService } from "@/src/domains/prizes/services/AllocationService";

export async function ensureDraftBatch(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Check if a batch exists
  const { data: existingBatch, error: existingError } = await supabase
    .from("prize_allocation_batches")
    .select("id, status")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existingBatch) {
    return existingBatch;
  }

  // Create a new Draft batch
  const { data: newBatch, error: newError } = await supabase
    .from("prize_allocation_batches")
    .insert({
      event_id: eventId,
      status: "Draft",
    })
    .select("id, status")
    .single();

  if (newError) throw new Error(newError.message);
  return newBatch;
}

export async function createPrizeCategory(data: {
  eventId: string;
  name: string;
  description: string;
  prizeType: string;
  totalAmount: number;
  currency?: string | null;
  maxWinners: number;
}) {
  const supabase = await createClient();

  const { data: cat, error } = await supabase
    .from("prize_categories")
    .insert({
      event_id: data.eventId,
      name: data.name,
      description: data.description,
      prize_type: data.prizeType,
      total_amount: data.totalAmount,
      currency: data.currency || null,
      max_winners: data.maxWinners,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return cat;
}

export async function allocatePrizeAction(
  batchId: string,
  categoryId: string,
  submissionId: string,
  amount: number,
  reason: string,
  snapshotId: string,
) {
  return await AllocationService.allocatePrize(
    batchId,
    categoryId,
    submissionId,
    amount,
    reason,
    snapshotId,
  );
}

export async function removeAllocationAction(allocationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.rpc("remove_prize_allocation", {
    p_allocation_id: allocationId,
    p_user_id: user.id,
  });

  if (error) throw new Error(error.message);
  return true;
}

export async function validateBatchAction(batchId: string) {
  const supabase = await createClient();

  // Fetch batch allocations
  const { data: allocations, error: allocError } = await supabase
    .from("prize_allocations")
    .select("*, prize_categories(*)")
    .eq("batch_id", batchId);

  if (allocError) throw new Error(allocError.message);

  const errors: string[] = [];

  interface CategoryUsage {
    total: number;
    count: number;
    category: { name: string; total_amount: number | string; max_winners: number };
  }
  const catUsage = new Map<string, CategoryUsage>();

  allocations?.forEach((a) => {
    const cid = a.category_id as string;
    if (!catUsage.has(cid)) {
      const rawCat = Array.isArray(a.prize_categories) ? a.prize_categories[0] : a.prize_categories;
      catUsage.set(cid, { total: 0, count: 0, category: rawCat as CategoryUsage["category"] });
    }
    const usage = catUsage.get(cid)!;
    usage.total += Number(a.amount);
    usage.count += 1;
  });

  catUsage.forEach((usage, _cid) => {
    if (usage.total > Number(usage.category.total_amount)) {
      errors.push(
        `Category "${usage.category.name}" is over budget. Allocated: ${usage.total}, Max: ${usage.category.total_amount}`,
      );
    }
    if (usage.count > usage.category.max_winners) {
      errors.push(
        `Category "${usage.category.name}" exceeded max winners. Allocated: ${usage.count}, Max: ${usage.category.max_winners}`,
      );
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Update batch status to Validated
  await supabase.from("prize_allocation_batches").update({ status: "Validated" }).eq("id", batchId);

  return { valid: true, errors: [] };
}

export async function lockBatchAction(batchId: string) {
  return await AllocationService.lockBatch(batchId);
}
