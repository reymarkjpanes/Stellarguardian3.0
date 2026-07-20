import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EscrowService } from './EscrowService';
import { MockStellarAdapter } from '../adapters/MockStellarAdapter';

// We'll mock the Supabase client
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn()
};

describe('EscrowService', () => {
  let service: EscrowService;
  let adapter: MockStellarAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new MockStellarAdapter();
    service = new EscrowService(mockSupabase as any, adapter);
  });

  describe('createEscrow', () => {
    it('creates an escrow via adapter and saves to DB', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'escrow-123', error: null });
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      const result = await service.createEscrow('event-1', 'batch-1', 1000, 'user-1');
      
      expect(result.escrowId).toBe('escrow-123');
      expect(result.address).toMatch(/^G[A-Z2-7]{55}$/);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_escrow_account', expect.any(Object));
    });
  });

  describe('verifyFunding', () => {
    it('returns true and records funding when provider confirms', async () => {
      // Mock fetching escrow
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'escrow-123',
            contract_address: 'GVALIDADDRESS123',
            expected_balance: 1000,
            status: 'Draft'
          },
          error: null
        })
      });

      mockSupabase.rpc.mockResolvedValue({ error: null });

      const isFunded = await service.verifyFunding('escrow-123');
      
      expect(isFunded).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_funding_verification', expect.objectContaining({
        p_amount: 1000,
        p_source_type: 'BlockchainDeposit'
      }));
    });

    it('returns false when provider cannot verify funding', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'escrow-123',
            contract_address: 'GFAIL_ADDRESS',
            expected_balance: 1000,
            status: 'Draft'
          },
          error: null
        })
      });

      const isFunded = await service.verifyFunding('escrow-123');
      
      expect(isFunded).toBe(false);
      expect(mockSupabase.rpc).not.toHaveBeenCalledWith('record_funding_verification', expect.anything());
    });
  });

  describe('generatePayoutBatch', () => {
    it('generates a batch and instructions when status is Verified/Funded', async () => {
      // RPC mock for batch generation
      mockSupabase.rpc.mockResolvedValue({ data: 'batch-123', error: null });
      
      // Mock fetching batch and allocations
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'payout_batches') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { prize_allocation_batch_id: 'pa-batch-1' },
              error: null
            })
          };
        }
        if (table === 'prize_allocations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'alloc-1', amount: 500 },
                { id: 'alloc-2', amount: 500 }
              ],
              error: null
            })
          };
        }
        if (table === 'payout_instructions') {
          return {
            insert: insertMock
          };
        }
        return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
      });

      const batchId = await service.generatePayoutBatch('escrow-123', 'user-1', 'idempotent-key-1');
      
      expect(batchId).toBe('batch-123');
      // Should have inserted 2 instructions
      expect(insertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ amount: 500 }),
          expect.objectContaining({ amount: 500 })
        ])
      );
    });
  });
  
  describe('executePayoutBatch', () => {
    it('executes batch and marks instructions as Broadcast', async () => {
      // Mock fetching batch
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'payout_batches') {
          const chain = {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { 
                status: 'Pending', 
                idempotency_key: 'idempotent-key-1', 
                escrow_accounts: { contract_address: 'G123' } 
              },
              error: null
            })
          };
          return chain;
        }
        if (table === 'payout_instructions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'inst-1', recipient_wallet: 'GABC', amount: 500, currency: 'USD' }
              ],
              error: null
            })
          };
        }
        return { select: vi.fn(), update: vi.fn(), eq: vi.fn() };
      });

      mockSupabase.rpc.mockResolvedValue({ error: null });

      const txHash = await service.executePayoutBatch('batch-123');
      
      expect(txHash).toMatch(/^batch_tx_/);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_payout_instruction_status', expect.objectContaining({
        p_status: 'Broadcast'
      }));
    });
    
    it('fails when provider throws and marks as Failed', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'payout_batches') {
          return {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { 
                status: 'Pending', 
                idempotency_key: 'fail_batch', 
                escrow_accounts: { contract_address: 'G123' } 
              },
              error: null
            })
          };
        }
        if (table === 'payout_instructions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'inst-1', recipient_wallet: 'GABC', amount: 500, currency: 'USD' }
              ],
              error: null
            })
          };
        }
        return { select: vi.fn(), update: vi.fn(), eq: vi.fn() };
      });

      mockSupabase.rpc.mockResolvedValue({ error: null });

      await expect(service.executePayoutBatch('batch-123')).rejects.toThrow('Simulated network failure');
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_payout_instruction_status', expect.objectContaining({
        p_status: 'Failed'
      }));
    });
  });
});
