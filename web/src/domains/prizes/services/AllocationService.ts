import { createServerClient as createClient } from '@/lib/supabase/server';
import { PrizeDomainEvent } from '../domain/PrizeDomainEvents';
import { PrizeAllocation } from '../domain/PrizeAllocation';

export class AllocationService {
  /**
   * Automatically suggests allocations based on rankings and a template strategy.
   * This is a non-destructive dry-run that returns a list of proposed allocations
   * which the organizer can review and modify before persisting.
   */
  static async generateSuggestions(eventId: string, snapshotId: string): Promise<Partial<PrizeAllocation>[]> {
    const supabase = await createClient();

    // 1. Fetch Categories for Event
    const { data: categories, error: catError } = await supabase
      .from('prize_categories')
      .select('*')
      .eq('event_id', eventId);
      
    if (catError) throw new Error(catError.message);
    if (!categories || categories.length === 0) return [];

    // 2. Fetch Rankings Snapshot
    const { data: snapshot, error: snapError } = await supabase
      .from('event_rankings_snapshot')
      .select('*')
      .eq('id', snapshotId)
      .order('ranking', { ascending: true });

    if (snapError) throw new Error(snapError.message);
    if (!snapshot || snapshot.length === 0) return [];

    const suggestions: Partial<PrizeAllocation>[] = [];

    // Very naive suggestion logic: Assign Rank 1 to the first category, Rank 2 to second, etc.
    // In reality, templates would map explicit ranks to categories.
    const sortedCategories = categories.sort((a, b) => b.total_amount - a.total_amount);

    for (let i = 0; i < Math.min(snapshot.length, sortedCategories.length); i++) {
      const cat = sortedCategories[i];
      const rank = snapshot[i];

      suggestions.push({
        categoryId: cat.id,
        submissionId: rank.submission_id,
        amount: cat.total_amount, // Give the whole amount to the first winner for now
        allocationStatus: 'Draft',
        allocationReason: `Auto-suggested for Rank #${rank.ranking}`,
        rankingSnapshotId: snapshotId,
      });
    }

    return suggestions;
  }

  /**
   * Persists a single allocation using the RPC safely.
   */
  static async allocatePrize(
    batchId: string,
    categoryId: string,
    submissionId: string,
    amount: number,
    reason: string,
    snapshotId: string
  ): Promise<{ allocationId: string, events: PrizeDomainEvent[] }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase.rpc('allocate_prize', {
      p_batch_id: batchId,
      p_category_id: categoryId,
      p_submission_id: submissionId,
      p_amount: amount,
      p_reason: reason,
      p_ranking_snapshot_id: snapshotId,
      p_user_id: user.id
    });

    if (error) throw new Error(`Failed to allocate prize: ${error.message}`);

    const events: PrizeDomainEvent[] = [{
      type: 'PrizeAllocated',
      allocationId: data,
      submissionId,
      categoryId,
      amount,
      timestamp: new Date()
    }];

    return { allocationId: data, events };
  }

  /**
   * Locks the batch for Escrow processing.
   */
  static async lockBatch(batchId: string): Promise<PrizeDomainEvent[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase.rpc('lock_prize_allocations', {
      p_batch_id: batchId,
      p_user_id: user.id
    });

    if (error) throw new Error(`Failed to lock batch: ${error.message}`);

    return [{
      type: 'PrizeAllocationLocked',
      batchId,
      lockedBy: user.id,
      timestamp: new Date()
    }];
  }
}
