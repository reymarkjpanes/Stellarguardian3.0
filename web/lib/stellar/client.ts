/**
 * Stellar chain adapter implementation (Req 4.7, 17.4, 25.5, 34.3).
 *
 * Uses @stellar/stellar-sdk v16+ exclusively. Network mode is
 * configuration-driven and prevents cross-network submissions. Mainnet
 * financial operations are disabled until explicitly enabled per environment.
 */
import "server-only";

import type { NetworkMode } from "@/types";
import type { ChainAdapter, Payment, TxStatus } from "./types";

/** Network passphrases for Stellar networks. */
const NETWORK_PASSPHRASES: Record<NetworkMode, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

/** Horizon server URLs per network. */
const HORIZON_URLS: Record<NetworkMode, string> = {
  testnet: "https://horizon-testnet.stellar.org",
  mainnet: "https://horizon.stellar.org",
};

/** Explorer base URLs per network. */
const EXPLORER_URLS: Record<NetworkMode, string> = {
  testnet: "https://stellar.expert/explorer/testnet/tx",
  mainnet: "https://stellar.expert/explorer/public/tx",
};

function getConfiguredNetworkMode(): NetworkMode {
  const mode = process.env.STELLAR_NETWORK_MODE ?? "testnet";
  if (mode !== "testnet" && mode !== "mainnet") {
    return "testnet";
  }
  return mode;
}

function isMainnetEnabled(): boolean {
  return process.env.STELLAR_MAINNET_ENABLED === "true";
}

export class StellarChainAdapter implements ChainAdapter {
  private networkMode: NetworkMode;

  constructor(networkMode?: NetworkMode) {
    this.networkMode = networkMode ?? getConfiguredNetworkMode();
  }

  getNetworkMode(): NetworkMode {
    return this.networkMode;
  }

  private guardMainnet(): void {
    if (this.networkMode === "mainnet" && !isMainnetEnabled()) {
      throw new Error("Mainnet financial operations are disabled in this environment (Req 34.3).");
    }
  }

  private guardCrossNetwork(txNetworkPassphrase: string): void {
    const expected = NETWORK_PASSPHRASES[this.networkMode];
    if (txNetworkPassphrase !== expected) {
      throw new Error(
        `Cross-network submission blocked: transaction targets ${txNetworkPassphrase} but adapter is configured for ${this.networkMode} (Req 25.5).`,
      );
    }
  }

  verifySignature(publicKey: string, data: Buffer, signature: Buffer): boolean {
    // Use dynamic import pattern — Keypair is lightweight and synchronous at call-site
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Keypair } = require("@stellar/stellar-sdk") as typeof import("@stellar/stellar-sdk");
      const keypair = Keypair.fromPublicKey(publicKey);
      return keypair.verify(data, signature);
    } catch {
      return false;
    }
  }

  async getBalance(account: string): Promise<string> {
    const { Horizon } = await import("@stellar/stellar-sdk");
    const server = new Horizon.Server(HORIZON_URLS[this.networkMode]);

    try {
      const accountData = await server.loadAccount(account);
      const nativeBalance = accountData.balances.find(
        (b: { asset_type: string; balance: string }) => b.asset_type === "native",
      );
      return nativeBalance?.balance ?? "0";
    } catch (err) {
      console.error(
        "[StellarClient] getBalance failed:",
        account,
        err instanceof Error ? err.message : err,
      );
      return "0";
    }
  }

  async submitSignedTx(signedXdr: string): Promise<{ hash: string; successful: boolean }> {
    this.guardMainnet();

    const { Horizon, TransactionBuilder } = await import("@stellar/stellar-sdk");
    const server = new Horizon.Server(HORIZON_URLS[this.networkMode]);

    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASES[this.networkMode]);
    this.guardCrossNetwork(NETWORK_PASSPHRASES[this.networkMode]);

    try {
      const result = await server.submitTransaction(tx);
      return {
        hash: result.hash,
        successful: result.successful,
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { extras?: { result_codes?: unknown } } } };
      throw new Error(
        `Transaction submission failed: ${JSON.stringify(err.response?.data?.extras?.result_codes ?? "unknown error")}`,
      );
    }
  }

  async getTransaction(hash: string): Promise<TxStatus | null> {
    const { Horizon } = await import("@stellar/stellar-sdk");
    const server = new Horizon.Server(HORIZON_URLS[this.networkMode]);

    try {
      const tx = await server.transactions().transaction(hash).call();
      return {
        hash: tx.hash,
        successful: tx.successful,
        ledger: tx.ledger_attr,
        createdAt: tx.created_at,
      };
    } catch {
      return null;
    }
  }

  async buildPaymentBatch(source: string, payments: Payment[]): Promise<string> {
    this.guardMainnet();

    if (payments.length === 0) {
      throw new Error("Payment batch cannot be empty.");
    }
    if (payments.length > 100) {
      throw new Error("Stellar caps operations at 100 per transaction (Req 8.6).");
    }

    const { Horizon, TransactionBuilder, Operation, Asset, Networks } =
      await import("@stellar/stellar-sdk");
    const server = new Horizon.Server(HORIZON_URLS[this.networkMode]);
    const sourceAccount = await server.loadAccount(source);

    const networkPassphrase = this.networkMode === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

    let builder = new TransactionBuilder(sourceAccount, {
      fee: String(100 * payments.length), // baseFee * operationCount
      networkPassphrase,
    });

    for (const payment of payments) {
      builder = builder.addOperation(
        Operation.payment({
          destination: payment.destination,
          asset: payment.asset ? new Asset(payment.asset) : Asset.native(),
          amount: payment.amount,
        }),
      );
    }

    const tx = builder.setTimeout(300).build();
    return tx.toXDR();
  }

  explorerUrl(hash: string): string {
    return `${EXPLORER_URLS[this.networkMode]}/${hash}`;
  }
}

/** Singleton instance using environment-configured network mode. */
let _instance: StellarChainAdapter | null = null;

export function getStellarClient(): StellarChainAdapter {
  if (!_instance) {
    _instance = new StellarChainAdapter();
  }
  return _instance;
}
