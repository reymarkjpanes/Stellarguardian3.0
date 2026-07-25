import {
  EscrowProvider,
  EscrowFundingVerification,
  PayoutInstruction,
  ProviderIdentity,
  TransactionSigner,
} from "../domain/EscrowProvider";
import * as StellarSdk from "@stellar/stellar-sdk";

interface HorizonPaymentRecord {
  type: string;
  to: string;
  amount: string;
  transaction_hash: string;
  created_at: string;
}

interface HorizonError {
  response?: {
    status?: number;
    data?: { extras?: { result_codes?: { transaction?: string } } };
  };
  message: string;
}

/**
 * Stellar Escrow Adapter for Sprint 8.2
 * Interfaces with the real Stellar Testnet.
 */
export class StellarEscrowAdapter implements EscrowProvider {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;
  private signer: TransactionSigner;

  constructor(signer: TransactionSigner, network: "testnet" | "public" = "testnet") {
    this.signer = signer;
    if (network === "testnet") {
      this.server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
      this.networkPassphrase = StellarSdk.Networks.TESTNET;
    } else {
      this.server = new StellarSdk.Horizon.Server("https://horizon.stellar.org");
      this.networkPassphrase = StellarSdk.Networks.PUBLIC;
    }
  }

  getIdentity(): ProviderIdentity {
    return {
      provider: "StellarEscrowAdapter",
      version: "1.0.0",
      network: this.networkPassphrase === StellarSdk.Networks.TESTNET ? "testnet" : "public",
      capabilities: {
        supportedNetworks: ["testnet", "public"],
        supportedAssets: ["XLM", "USDC"],
        requiresMemo: false,
        maximumBatchSize: 100,
        feeModel: "dynamic",
      },
    };
  }

  async createEscrow(): Promise<{ address: string; metadata?: Record<string, unknown> }> {
    const address = this.signer.getPublicKey();
    return { address, metadata: { network: this.getIdentity().network } };
  }

  async getEscrowStatus(address: string): Promise<{ balance: number; status: string }> {
    try {
      const account = await this.server.loadAccount(address);
      const nativeBalance = account.balances.find((b) => b.asset_type === "native");
      const balanceStr = nativeBalance ? nativeBalance.balance : "0";
      return { balance: parseFloat(balanceStr), status: "Active" };
    } catch (err) {
      const e = err as HorizonError;
      if (e.response?.status === 404) {
        return { balance: 0, status: "Not Found" };
      }
      throw new Error(`Failed to load account: ${e.message}`);
    }
  }

  async verifyFunding(
    address: string,
    expectedAmount: number,
  ): Promise<EscrowFundingVerification | null> {
    try {
      const payments = await this.server
        .payments()
        .forAccount(address)
        .order("desc")
        .limit(10)
        .call();

      for (const record of payments.records) {
        const r = record as unknown as HorizonPaymentRecord;
        if (r.type === "payment" && r.to === address) {
          const amount = parseFloat(r.amount);
          if (amount >= expectedAmount) {
            return {
              txHash: r.transaction_hash,
              amount,
              timestamp: r.created_at,
              blockHeight: 0,
              verifiedByProvider: this.getIdentity().provider,
            };
          }
        }
      }
      return null;
    } catch (err) {
      const e = err as HorizonError;
      if (e.response?.status === 404) return null;
      throw new Error(`Failed to verify funding: ${e.message}`);
    }
  }

  async simulatePayoutBatch(
    address: string,
    instructions: PayoutInstruction[],
  ): Promise<{ isValid: boolean; estimatedFee: number; errors?: string }> {
    if (instructions.length > this.getIdentity().capabilities.maximumBatchSize) {
      return { isValid: false, estimatedFee: 0, errors: "Batch size exceeds 100" };
    }

    try {
      const account = await this.server.loadAccount(address);
      const feeStats = await this.server.feeStats();
      const baseFee = parseInt(feeStats.fee_charged.mode, 10) || Number(StellarSdk.BASE_FEE || 100);
      const estimatedFeeStroops = baseFee * instructions.length;
      const estimatedFeeXLM = estimatedFeeStroops / 1e7;

      let totalAmount = 0;
      for (const inst of instructions) {
        if (inst.amount <= 0) {
          return {
            isValid: false,
            estimatedFee: estimatedFeeXLM,
            errors: `Invalid amount ${inst.amount} for ${inst.recipientWallet}`,
          };
        }
        totalAmount += inst.amount;
      }

      const nativeBalance = account.balances.find((b) => b.asset_type === "native");
      const balanceStr = nativeBalance ? nativeBalance.balance : "0";
      if (parseFloat(balanceStr) < totalAmount + estimatedFeeXLM) {
        return {
          isValid: false,
          estimatedFee: estimatedFeeXLM,
          errors: `Insufficient balance: Have ${balanceStr}, need ${totalAmount + estimatedFeeXLM}`,
        };
      }

      return { isValid: true, estimatedFee: estimatedFeeXLM };
    } catch (err) {
      const e = err as HorizonError;
      return { isValid: false, estimatedFee: 0, errors: e.message };
    }
  }

  async executePayoutBatch(
    address: string,
    _idempotencyKey: string,
    instructions: PayoutInstruction[],
  ): Promise<{ txHash: string }> {
    const account = await this.server.loadAccount(address);
    const feeStats = await this.server.feeStats();
    const baseFee = parseInt(feeStats.fee_charged.mode, 10) || Number(StellarSdk.BASE_FEE || 100);

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: (baseFee * instructions.length).toString(),
      networkPassphrase: this.networkPassphrase,
    });

    for (const inst of instructions) {
      txBuilder.addOperation(
        StellarSdk.Operation.payment({
          destination: inst.recipientWallet,
          asset: StellarSdk.Asset.native(),
          amount: inst.amount.toString(),
        }),
      );
    }

    txBuilder.setTimeout(180);
    const transaction = txBuilder.build();

    const signedTransaction = (await this.signer.sign(transaction)) as StellarSdk.Transaction;

    try {
      const response = await this.server.submitTransaction(signedTransaction);
      return { txHash: response.hash };
    } catch (err) {
      const e = err as HorizonError;
      throw new Error(
        `Broadcast failed: ${e.response?.data?.extras?.result_codes?.transaction ?? e.message}`,
      );
    }
  }

  async getTransactionStatus(
    txHash: string,
  ): Promise<{ status: "Pending" | "Confirmed" | "Finalized" | "Failed"; failureReason?: string }> {
    try {
      const tx = await this.server.transactions().transaction(txHash).call();
      if (tx.successful) {
        return { status: "Finalized" };
      }
      return { status: "Failed", failureReason: "Transaction marked unsuccessful on ledger" };
    } catch (err) {
      const e = err as HorizonError;
      if (e.response?.status === 404) return { status: "Pending" };
      throw new Error(`Failed to fetch tx status: ${e.message}`);
    }
  }

  async refundEscrow(address: string, targetAddress: string): Promise<{ txHash: string }> {
    const account = await this.server.loadAccount(address);
    const nativeBalance = account.balances.find((b) => b.asset_type === "native");
    const balance = nativeBalance ? parseFloat(nativeBalance.balance) : 0;

    if (balance <= 0) {
      throw new Error("Escrow account has no balance to refund.");
    }

    const feeStats = await this.server.feeStats();
    const baseFee = parseInt(feeStats.fee_charged.mode, 10) || Number(StellarSdk.BASE_FEE || 100);
    const feeXlm = baseFee / 1e7;
    const refundAmount = Math.max(0, balance - feeXlm - 1).toFixed(7);

    if (parseFloat(refundAmount) <= 0) {
      throw new Error("Escrow balance is too low to cover refund fees.");
    }

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: baseFee.toString(),
      networkPassphrase: this.networkPassphrase,
    });

    txBuilder.addOperation(
      StellarSdk.Operation.payment({
        destination: targetAddress,
        asset: StellarSdk.Asset.native(),
        amount: refundAmount,
      }),
    );

    txBuilder.setTimeout(180);
    const transaction = txBuilder.build();

    const signedTransaction = (await this.signer.sign(transaction)) as StellarSdk.Transaction;

    try {
      const response = await this.server.submitTransaction(signedTransaction);
      return { txHash: response.hash };
    } catch (err) {
      const e = err as HorizonError;
      throw new Error(
        `Refund broadcast failed: ${e.response?.data?.extras?.result_codes?.transaction ?? e.message}`,
      );
    }
  }
}
