/**
 * xBull wallet adapter.
 *
 * xBull is a Stellar browser extension wallet that exposes a global
 * `window.xBull` object with a similar API surface to Freighter.
 * Docs: https://xbull.app/docs
 */
import type { NetworkMode } from "@/types";
import type { WalletAdapter } from "./types";

interface XBullWindow {
  connect(): Promise<{ publicKey: string }>;
  getPublicKey(): Promise<string>;
  getNetwork(): Promise<{ network: string; networkPassphrase: string }>;
  signTransaction(
    xdr: string,
    opts?: { network?: string; networkPassphrase?: string },
  ): Promise<{ signedTxXdr: string }>;
  signMessage(message: string, opts?: { publicKey?: string }): Promise<{ signedMessage: string }>;
}

declare global {
  interface Window {
    xBull?: XBullWindow;
  }
}

function getXBull(): XBullWindow | null {
  if (typeof window === "undefined") return null;
  return window.xBull ?? null;
}

function mapNetwork(network: string): NetworkMode {
  const n = network.toLowerCase();
  if (n.includes("public") || n.includes("mainnet")) return "mainnet";
  return "testnet";
}

export class XBullAdapter implements WalletAdapter {
  readonly provider = "xBull" as const;

  async isAvailable(): Promise<boolean> {
    return getXBull() !== null;
  }

  async connect(): Promise<{ publicKey: string; network: NetworkMode }> {
    const xbull = getXBull();
    if (!xbull) throw new Error("xBull extension is not installed.");

    const { publicKey } = await xbull.connect();
    const { network } = await xbull.getNetwork();
    return { publicKey, network: mapNetwork(network) };
  }

  async disconnect(): Promise<void> {
    // xBull doesn't expose a programmatic disconnect
  }

  async getPublicKey(): Promise<string> {
    const xbull = getXBull();
    if (!xbull) throw new Error("xBull extension is not installed.");
    return xbull.getPublicKey();
  }

  async getNetwork(): Promise<NetworkMode> {
    const xbull = getXBull();
    if (!xbull) throw new Error("xBull extension is not installed.");
    const { network } = await xbull.getNetwork();
    return mapNetwork(network);
  }

  async signTransaction(xdr: string, network: NetworkMode): Promise<string> {
    const xbull = getXBull();
    if (!xbull) throw new Error("xBull extension is not installed.");

    const networkPassphrase =
      network === "mainnet"
        ? "Public Global Stellar Network ; September 2015"
        : "Test SDF Network ; September 2015";

    const result = await xbull.signTransaction(xdr, { networkPassphrase });
    return result.signedTxXdr;
  }

  async signMessage(message: string): Promise<string> {
    const xbull = getXBull();
    if (!xbull) throw new Error("xBull extension is not installed.");
    const result = await xbull.signMessage(message);
    return result.signedMessage;
  }
}
