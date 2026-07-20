import { PrizeAllocation } from './PrizeAllocation';

export type BatchStatus = 'Draft' | 'Validated' | 'Locked' | 'Escrowed';

export interface PrizeAllocationBatch {
  id: string;
  eventId: string;
  status: BatchStatus;
  lockedAt: Date | null;
  lockedBy: string | null;
  allocations: PrizeAllocation[];
}
