/**
 * Wallet Adapter interface and types (Req 25.1, 25.2, 33.1, 33.2).
 *
 * Defines the contract all wallet adapters must implement. The registry
 * exposes extension points for additional providers (Albedo, xBull, Rabet)
 * without changing consumers.
 */
import type { NetworkMode } from "@/types";

export type WalletProvider = "Freighter" | "Albedo" | "xBull" | "Rabet";

export type WalletConnectionState =
  | "Disconnected"
  | "Connecting"
  | "Connected"
  | "Verified"
  | "Error";

export interface WalletAdapter {
  readonly provider: WalletProvider;
  isAvailable(): Promise<boolean>;
  connect(): Promise<{ publicKey: string; network: NetworkMode }>;
  disconnect(): Promise<void>;
  getPublicKey(): Promise<string>;
  getNetwork(): Promise<NetworkMode>;
  signTransaction(xdr: string, network: NetworkMode): Promise<string>;
  signMessage(message: string): Promise<string>;
}

export interface WalletState {
  connectionState: WalletConnectionState;
  publicKey: string | null;
  network: NetworkMode | null;
  provider: WalletProvider | null;
  error: string | null;
}
