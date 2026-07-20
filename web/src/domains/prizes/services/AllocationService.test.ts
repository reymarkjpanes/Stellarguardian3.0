import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AllocationService } from './AllocationService';

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => {
  const rpcMock = vi.fn();
  const selectMock = vi.fn();
  const eqMock = vi.fn();
  const orderMock = vi.fn();
  const authMock = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }) };

  const chainable = {
    select: selectMock,
    eq: eqMock,
    order: orderMock,
  };
  
  selectMock.mockReturnValue(chainable);
  eqMock.mockReturnValue(chainable);
  orderMock.mockReturnValue(chainable);

  return {
    createClient: vi.fn().mockResolvedValue({
      rpc: rpcMock,
      from: vi.fn().mockReturnValue(chainable),
      auth: authMock
    })
  };
});

import { createClient } from '@/lib/supabase/server';

describe('AllocationService', () => {
  let supabaseMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    supabaseMock = await createClient();
  });

  describe('allocatePrize', () => {
    it('returns domain event on success', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ data: 'new-allocation-id', error: null });

      const result = await AllocationService.allocatePrize(
        'batch-123',
        'cat-456',
        'sub-789',
        1000,
        'Great UI',
        'snap-000'
      );

      expect(supabaseMock.rpc).toHaveBeenCalledWith('allocate_prize', {
        p_batch_id: 'batch-123',
        p_category_id: 'cat-456',
        p_submission_id: 'sub-789',
        p_amount: 1000,
        p_reason: 'Great UI',
        p_ranking_snapshot_id: 'snap-000',
        p_user_id: 'test-user-id'
      });

      expect(result.allocationId).toBe('new-allocation-id');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('PrizeAllocated');
    });

    it('throws error if rpc fails (e.g. budget exceeded)', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Allocation exceeds category budget.' } 
      });

      await expect(
        AllocationService.allocatePrize('batch-123', 'cat-456', 'sub-789', 99999, 'Reason', 'snap-000')
      ).rejects.toThrow('Failed to allocate prize: Allocation exceeds category budget.');
    });
  });

  describe('lockBatch', () => {
    it('returns lock event on success', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: null });

      const events = await AllocationService.lockBatch('batch-123');

      expect(supabaseMock.rpc).toHaveBeenCalledWith('lock_prize_allocations', {
        p_batch_id: 'batch-123',
        p_user_id: 'test-user-id'
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('PrizeAllocationLocked');
      expect(events[0].lockedBy).toBe('test-user-id');
    });
  });
});
