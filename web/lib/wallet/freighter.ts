/**
 * Freighter wallet adapter (Req 33.1).
 *
 * Primary adapter implementing the WalletAdapter interface for the Freighter
 * browser extension. Freighter APIs are accessed via the injected
 * `window.freighterApi` global.
 */
import type { NetworkMode } from "@/types";
import type { WalletAdapter } from "./types";

/** Freighter browser extension API shape (injected as window.freighterApi). */
interface FreighterApi {
  isConnected(): Promise<boolean>;
  getPublicKey(): Promise<string>;
  getNetwork(): Promise<string>;
  signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string; accountToSign?: string },
  ): Promise<string>;
  signMessage(message: string, opts?: { accountToSign?: string }): Promise<string>;
}

declare global {
  interface Window {
    freighterApi?: FreighterApi;
  }
}

function getFreighterApi(): FreighterApi {
  if (typeof window === "undefined" || !window.freighterApi) {
    throw new Error(
      "Freighter extension not detected. Please install Freighter to connect your wallet.",
    );
  }
  return window.freighterApi;
}

function mapNetwork(freighterNetwork: string): NetworkMode {
  const normalized = freighterNetwork.toLowerCase();
  if (normalized.includes("public") || normalized.includes("mainnet")) return "mainnet";
  return "testnet";
}

export class FreighterAdapter implements WalletAdapter {
  readonly provider = "Freighter" as const;

  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    return !!window.freighterApi;
  }

  async connect(): Promise<{ publicKey: string; network: NetworkMode }> {
    const api = getFreighterApi();
    const publicKey = await api.getPublicKey();
    const rawNetwork = await api.getNetwork();
    return { publicKey, network: mapNetwork(rawNetwork) };
  }

  async disconnect(): Promise<void> {
    // Freighter doesn't have a programmatic disconnect; we just clear local state.
  }

  async getPublicKey(): Promise<string> {
    const api = getFreighterApi();
    return api.getPublicKey();
  }

  async getNetwork(): Promise<NetworkMode> {
    const api = getFreighterApi();
    const rawNetwork = await api.getNetwork();
    return mapNetwork(rawNetwork);
  }

  async signTransaction(xdr: string, network: NetworkMode): Promise<string> {
    const api = getFreighterApi();
    const networkPassphrase =
      network === "mainnet"
        ? "Public Global Stellar Network ; September 2015"
        : "Test SDF Network ; September 2015";
    return api.signTransaction(xdr, { networkPassphrase });
  }

  async signMessage(message: string): Promise<string> {
    const api = getFreighterApi();
    return api.signMessage(message);
  }
}
