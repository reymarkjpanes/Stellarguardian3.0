import {
  EscrowProvider,
  EscrowFundingVerification,
  PayoutInstruction,
  ProviderIdentity,
} from "../domain/EscrowProvider";

/**
 * Mock Stellar Adapter for Sprint 8.1 / Testing
 * Simulates network latency and provides deterministic success/failure testing.
 */
export class MockStellarAdapter implements EscrowProvider {
  private networkDelay = 500;

  private async simulateLatency() {
    return new Promise((resolve) => setTimeout(resolve, this.networkDelay));
  }

  getIdentity(): ProviderIdentity {
    return {
      provider: "MockStellarAdapter",
      version: "1.0.0",
      network: "testnet",
      capabilities: {
        supportedNetworks: ["testnet"],
        supportedAssets: ["USDC"],
        requiresMemo: false,
        maximumBatchSize: 100,
        feeModel: "fixed",
      },
    };
  }

  async createEscrow(): Promise<{ address: string; metadata?: Record<string, unknown> }> {
    await this.simulateLatency();
    const mockAddress = `G${Array.from({ length: 55 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)]).join("")}`;
    return {
      address: mockAddress,
      metadata: { mock: true, network: "testnet" },
    };
  }

  async getEscrowStatus(_address: string): Promise<{ balance: number; status: string }> {
    await this.simulateLatency();
    return { balance: 1000, status: "Active" };
  }

  async verifyFunding(
    address: string,
    expectedAmount: number,
  ): Promise<EscrowFundingVerification | null> {
    await this.simulateLatency();
    // In our mock, if address starts with "GFAIL", simulate missing funding.
    if (address.startsWith("GFAIL")) {
      return null;
    }

    return {
      txHash: `mock_tx_${Date.now()}`,
      amount: expectedAmount,
      timestamp: new Date().toISOString(),
      blockHeight: 12345678,
      verifiedByProvider: "MockStellarAdapter",
    };
  }

  async estimateFees(instructions: PayoutInstruction[]): Promise<{ totalFee: number }> {
    await this.simulateLatency();
    // Simulate 0.01 fee per instruction
    return { totalFee: instructions.length * 0.01 };
  }

  async simulatePayoutBatch(
    _address: string,
    instructions: PayoutInstruction[],
  ): Promise<{ isValid: boolean; estimatedFee: number; errors?: string }> {
    await this.simulateLatency();

    if (instructions.some((i) => i.amount < 0)) {
      return { isValid: false, estimatedFee: 0, errors: "Invalid negative amount" };
    }

    return { isValid: true, estimatedFee: instructions.length * 0.01 };
  }

  async executePayoutBatch(
    _address: string,
    idempotencyKey: string,
    _instructions: PayoutInstruction[],
  ): Promise<{ txHash: string }> {
    await this.simulateLatency();

    // Simulate failure if the idempotency key explicitly asks for it
    if (idempotencyKey.includes("fail_batch")) {
      throw new Error("Simulated network failure during batch execution");
    }

    return {
      txHash: `batch_tx_${idempotencyKey}`,
    };
  }

  async getTransactionStatus(
    txHash: string,
  ): Promise<{ status: "Pending" | "Confirmed" | "Finalized" | "Failed"; failureReason?: string }> {
    await this.simulateLatency();

    if (txHash.includes("fail")) {
      return { status: "Failed", failureReason: "Simulated transaction failure" };
    }

    return { status: "Confirmed" };
  }

  async refundEscrow(_address: string, _targetAddress: string): Promise<{ txHash: string }> {
    await this.simulateLatency();
    return { txHash: `refund_tx_${Date.now()}` };
  }
}
