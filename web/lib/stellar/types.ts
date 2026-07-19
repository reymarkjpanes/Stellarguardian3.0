/**
 * Chain adapter interface (Req 4.7, 25.5, 32.5, 34.3).
 *
 * Defines the contract the Stellar client (and future multi-chain adapters)
 * must implement. Network mode is configuration-driven and cross-network
 * submissions are prevented.
 */
import type { NetworkMode } from "@/types";

export interface Payment {
  destination: string;
  amount: string;
  asset?: string; // Default: native XLM
}

export interface TxStatus {
  hash: string;
  successful: boolean;
  ledger?: number;
  createdAt?: string;
}

export interface ChainAdapter {
  /** Verify a signature against a public key (Req 5.2). */
  verifySignature(publicKey: string, data: Buffer, signature: Buffer): boolean;
  /** Get the XLM balance of a Stellar account. */
  getBalance(account: string): Promise<string>;
  /** Submit a pre-signed transaction XDR to the network. */
  submitSignedTx(signedXdr: string): Promise<{ hash: string; successful: boolean }>;
  /** Get a transaction's status by hash. */
  getTransaction(hash: string): Promise<TxStatus | null>;
  /** Build a batch payment transaction (unsigned XDR) from escrow to winners. */
  buildPaymentBatch(source: string, payments: Payment[]): Promise<string>;
  /** Get the explorer URL for a transaction hash. */
  explorerUrl(hash: string): string;
  /** Get the configured network mode. */
  getNetworkMode(): NetworkMode;
}
