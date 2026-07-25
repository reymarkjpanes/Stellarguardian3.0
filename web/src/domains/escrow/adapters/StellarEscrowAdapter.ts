import { EscrowProvider, EscrowFundingVerification, PayoutInstruction, ProviderIdentity, TransactionSigner } from '../domain/EscrowProvider';
import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * Stellar Escrow Adapter for Sprint 8.2
 * Interfaces with the real Stellar Testnet.
 */
export class StellarEscrowAdapter implements EscrowProvider {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;
  private signer: TransactionSigner;

  constructor(signer: TransactionSigner, network: 'testnet' | 'public' = 'testnet') {
    this.signer = signer;
    if (network === 'testnet') {
      this.server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
      this.networkPassphrase = StellarSdk.Networks.TESTNET;
    } else {
      this.server = new StellarSdk.Horizon.Server('https://horizon.stellar.org');
      this.networkPassphrase = StellarSdk.Networks.PUBLIC;
    }
  }

  getIdentity(): ProviderIdentity {
    return {
      provider: 'StellarEscrowAdapter',
      version: '1.0.0',
      network: this.networkPassphrase === StellarSdk.Networks.TESTNET ? 'testnet' : 'public',
      capabilities: {
        supportedNetworks: ['testnet', 'public'],
        supportedAssets: ['XLM', 'USDC'],
        requiresMemo: false,
        maximumBatchSize: 100, // Stellar max operations per tx
        feeModel: 'dynamic'
      }
    };
  }

  /**
   * Phase 2: Create Escrow
   * In a real system, you might create a multi-sig account or use a derived key.
   * For this implementation, we can just return our signer's public key as the escrow address.
   * (If we wanted to generate a brand new account and fund it, we would need to issue a transaction).
   */
  async createEscrow(): Promise<{ address: string; metadata?: any }> {
    const address = this.signer.getPublicKey();
    return { address, metadata: { network: this.getIdentity().network } };
  }

  /**
   * Phase 1: Read-only balance
   */
  async getEscrowStatus(address: string): Promise<{ balance: number; status: string }> {
    try {
      const account = await this.server.loadAccount(address);
      const nativeBalance = account.balances.find(b => b.asset_type === 'native');
      const balanceStr = nativeBalance ? nativeBalance.balance : '0';
      return { balance: parseFloat(balanceStr), status: 'Active' };
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return { balance: 0, status: 'Not Found' };
      }
      throw new Error(`Failed to load account: ${err.message}`);
    }
  }

  /**
   * Phase 1: Verify Funding
   * Looks for a recent payment operation to this address that satisfies the expected amount.
   */
  async verifyFunding(address: string, expectedAmount: number): Promise<EscrowFundingVerification | null> {
    try {
      // Get recent payments to this account
      const payments = await this.server.payments()
        .forAccount(address)
        .order('desc')
        .limit(10)
        .call();

      for (const record of payments.records) {
        // Checking for a recent payment (simplistic check for Sprint 8.2)
        if (record.type === 'payment' && (record as any).to === address) {
          const amount = parseFloat((record as any).amount);
          if (amount >= expectedAmount) {
             return {
                txHash: record.transaction_hash,
                amount: amount,
                timestamp: record.created_at,
                blockHeight: 0, // Horizon doesn't easily expose block height on the payment record directly here without more calls
                verifiedByProvider: this.getIdentity().provider
             };
          }
        }
      }
      return null;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to verify funding: ${err.message}`);
    }
  }

  /**
   * Phase 2: Simulation
   */
  async simulatePayoutBatch(address: string, instructions: PayoutInstruction[]): Promise<{ isValid: boolean; estimatedFee: number; errors?: any }> {
    if (instructions.length > this.getIdentity().capabilities.maximumBatchSize) {
      return { isValid: false, estimatedFee: 0, errors: 'Batch size exceeds 100' };
    }

    try {
      const account = await this.server.loadAccount(address);
      const feeStats = await this.server.feeStats();
      const baseFee = parseInt(feeStats.fee_charged.mode, 10) || Number(StellarSdk.BASE_FEE || 100);
      const estimatedFeeStroops = baseFee * instructions.length;
      const estimatedFeeXLM = estimatedFeeStroops / 1e7;

      let totalAmount = 0;
      for (const inst of instructions) {
         if (inst.amount <= 0) return { isValid: false, estimatedFee: estimatedFeeXLM, errors: `Invalid amount ${inst.amount} for ${inst.recipientWallet}` };
         totalAmount += inst.amount;
      }

      const nativeBalance = account.balances.find(b => b.asset_type === 'native');
      const balanceStr = nativeBalance ? nativeBalance.balance : '0';
      if (parseFloat(balanceStr) < totalAmount + estimatedFeeXLM) {
          return { isValid: false, estimatedFee: estimatedFeeXLM, errors: `Insufficient balance: Have ${balanceStr}, need ${totalAmount + estimatedFeeXLM}` };
      }

      return { isValid: true, estimatedFee: estimatedFeeXLM };
    } catch (err: any) {
       return { isValid: false, estimatedFee: 0, errors: err.message };
    }
  }

  /**
   * Phase 3: Execute Batch
   */
  async executePayoutBatch(address: string, idempotencyKey: string, instructions: PayoutInstruction[]): Promise<{ txHash: string }> {
    const account = await this.server.loadAccount(address);
    const feeStats = await this.server.feeStats();
    const baseFee = parseInt(feeStats.fee_charged.mode, 10) || Number(StellarSdk.BASE_FEE || 100);
    
    // Using idempotencyKey conceptually. In Stellar, we can use a TimeBounds or specific sequence number management.
    // For this implementation, we'll build the transaction normally.

    let txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: (baseFee * instructions.length).toString(),
      networkPassphrase: this.networkPassphrase
    });

    for (const inst of instructions) {
      txBuilder.addOperation(StellarSdk.Operation.payment({
        destination: inst.recipientWallet,
        asset: StellarSdk.Asset.native(),
        amount: inst.amount.toString()
      }));
    }

    txBuilder.setTimeout(180);
    const transaction = txBuilder.build();

    // Sign using the injected signer
    const signedTransaction = await this.signer.sign(transaction) as StellarSdk.Transaction;

    try {
      const response = await this.server.submitTransaction(signedTransaction);
      return { txHash: response.hash };
    } catch (err: any) {
       throw new Error(`Broadcast failed: ${err?.response?.data?.extras?.result_codes?.transaction || err.message}`);
    }
  }

  /**
   * Phase 1: Transaction Status
   */
  async getTransactionStatus(txHash: string): Promise<{ status: 'Pending' | 'Confirmed' | 'Finalized' | 'Failed'; failureReason?: string }> {
    try {
      const tx = await this.server.transactions().transaction(txHash).call();
      if (tx.successful) {
        return { status: 'Finalized' };
      } else {
        return { status: 'Failed', failureReason: 'Transaction marked unsuccessful on ledger' };
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return { status: 'Pending' }; // Might just not be indexed yet
      }
      throw new Error(`Failed to fetch tx status: ${err.message}`);
    }
  }

  async refundEscrow(address: string, targetAddress: string): Promise<{ txHash: string }> {
    // Load the escrow account to get the current balance
    const account = await this.server.loadAccount(address);
    const nativeBalance = account.balances.find(b => b.asset_type === 'native');
    const balance = nativeBalance ? parseFloat(nativeBalance.balance) : 0;

    if (balance <= 0) {
      throw new Error('Escrow account has no balance to refund.');
    }

    // Reserve minimum balance for the transaction fee + base reserve
    const feeStats = await this.server.feeStats();
    const baseFee = parseInt(feeStats.fee_charged.mode, 10) || Number(StellarSdk.BASE_FEE || 100);
    const feeXlm = baseFee / 1e7;
    // Stellar requires 1 XLM base reserve; refund everything above fees
    const refundAmount = Math.max(0, balance - feeXlm - 1).toFixed(7);

    if (parseFloat(refundAmount) <= 0) {
      throw new Error('Escrow balance is too low to cover refund fees.');
    }

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: baseFee.toString(),
      networkPassphrase: this.networkPassphrase,
    });

    txBuilder.addOperation(StellarSdk.Operation.payment({
      destination: targetAddress,
      asset: StellarSdk.Asset.native(),
      amount: refundAmount,
    }));

    txBuilder.setTimeout(180);
    const transaction = txBuilder.build();

    const signedTransaction = await this.signer.sign(transaction) as StellarSdk.Transaction;

    try {
      const response = await this.server.submitTransaction(signedTransaction);
      return { txHash: response.hash };
    } catch (err: any) {
      throw new Error(`Refund broadcast failed: ${err?.response?.data?.extras?.result_codes?.transaction || err.message}`);
    }
  }
}
