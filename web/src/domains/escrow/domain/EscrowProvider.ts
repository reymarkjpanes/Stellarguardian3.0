export interface PayoutInstruction {
  id: string;
  recipientWallet: string;
  amount: number;
  currency: string;
}

export interface EscrowFundingVerification {
  txHash: string;
  amount: number;
  timestamp: string;
  blockHeight: number;
  verifiedByProvider: string;
}

export interface EscrowProviderCapabilities {
  supportedNetworks: string[];
  supportedAssets: string[];
  requiresMemo: boolean;
  maximumBatchSize: number;
  feeModel: 'fixed' | 'dynamic';
}

export interface ProviderIdentity {
  provider: string;
  version: string;
  network: string;
  capabilities: EscrowProviderCapabilities;
}

export interface EscrowProvider {
  /**
   * Returns provider identity and capabilities.
   */
  getIdentity(): ProviderIdentity;

  /**
   * Initializes an Escrow account on the blockchain.
   */
  createEscrow(): Promise<{ address: string; metadata?: any }>;

  /**
   * Fetches the current state/balance of the escrow from the chain.
   */
  getEscrowStatus(address: string): Promise<{ balance: number; status: string }>;

  /**
   * Verifies that the escrow account has received the expected funding.
   */
  verifyFunding(address: string, expectedAmount: number): Promise<EscrowFundingVerification | null>;

  /**
   * Simulates a batch payout without broadcasting to the network.
   */
  simulatePayoutBatch(address: string, instructions: PayoutInstruction[]): Promise<{ isValid: boolean; estimatedFee: number; errors?: any }>;

  /**
   * Executes a batch of payouts from the escrow account.
   */
  executePayoutBatch(address: string, idempotencyKey: string, instructions: PayoutInstruction[]): Promise<{ txHash: string }>;

  /**
   * Checks the status of a specific transaction hash.
   */
  getTransactionStatus(txHash: string): Promise<{ status: 'Pending' | 'Confirmed' | 'Finalized' | 'Failed'; failureReason?: string }>;

  /**
   * Refunds the remaining balance in the escrow back to the original funder.
   */
  refundEscrow(address: string, targetAddress: string): Promise<{ txHash: string }>;
}

/**
 * Abstraction for transaction signing. Keeps secrets out of the provider.
 */
export interface TransactionSigner {
  sign(transaction: any): Promise<any>;
  getPublicKey(): string;
}
