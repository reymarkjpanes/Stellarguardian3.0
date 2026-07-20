export type AllocationStatus = 'Draft' | 'Validated' | 'Locked' | 'Escrowed' | 'Paid' | 'Cancelled';

export interface PrizeAllocation {
  id: string;
  submissionId: string;
  teamId: string | null;
  categoryId: string;
  amount: number;
  allocationStatus: AllocationStatus;
  allocationReason: string | null;
  rankingSnapshotId: string | null;
  createdBy: string;
  createdAt: Date;
  version: number;
}
