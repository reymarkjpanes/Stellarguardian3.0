export interface PrizeCategoryCreated {
  type: 'PrizeCategoryCreated';
  categoryId: string;
  eventId: string;
  timestamp: Date;
}

export interface PrizeAllocated {
  type: 'PrizeAllocated';
  allocationId: string;
  submissionId: string;
  categoryId: string;
  amount: number;
  timestamp: Date;
}

export interface PrizeAllocationUpdated {
  type: 'PrizeAllocationUpdated';
  allocationId: string;
  newAmount: number;
  newStatus: string;
  timestamp: Date;
}

export interface PrizeAllocationRemoved {
  type: 'PrizeAllocationRemoved';
  allocationId: string;
  timestamp: Date;
}

export interface PrizeAllocationValidated {
  type: 'PrizeAllocationValidated';
  batchId: string;
  timestamp: Date;
}

export interface PrizeAllocationLocked {
  type: 'PrizeAllocationLocked';
  batchId: string;
  lockedBy: string;
  timestamp: Date;
}

export type PrizeDomainEvent = 
  | PrizeCategoryCreated 
  | PrizeAllocated 
  | PrizeAllocationUpdated 
  | PrizeAllocationRemoved 
  | PrizeAllocationValidated 
  | PrizeAllocationLocked;
