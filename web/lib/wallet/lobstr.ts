/**
 * LOBSTR wallet adapter.
 *
 * LOBSTR is one of the most popular Stellar wallets. It exposes a
 * window.lobstr global (extension) and also supports WalletConnect.
 * This adapter targets the browser extension flow.
 *
 * Docs: https://lobstr.co/lobstr-extension-api
 */
import type { NetworkMode } from "@/types";
import type { WalletAdapter } from "./types";

interface LobstrWindow {
  isLobstr?: boolean;
  getPublicKey(): Promise<string>;
  getNetwork(): Promise<{ network: string; networkPassphrase: string }>;
  signTransaction(
    xdr: string,
    opts?: { network?: string; networkPassphrase?: string },
  ): Promise<{ signedTxXdr: string }>;
  signMessage?(message: string): Promise<{ signedMessage: string }>;
}

declare global {
  interface Window {
    lobstr?: LobstrWindow;
  }
}

function getLobstr(): LobstrWindow | null {
  if (typeof window === "undefined") return null;
  return window.lobstr ?? null;
}

function mapNetwork(network: string): NetworkMode {
  const n = network.toLowerCase();
  if (n.includes("public") || n.includes("mainnet")) return "mainnet";
  return "testnet";
}

export class LobstrAdapter implements WalletAdapter {
  readonly provider = "LOBSTR" as const;

  async isAvailable(): Promise<boolean> {
    const lobstr = getLobstr();
    return lobstr !== null && lobstr.isLobstr === true;
  }

  async connect(): Promise<{ publicKey: string; network: NetworkMode }> {
    const lobstr = getLobstr();
    if (!lobstr) throw new Error("LOBSTR extension is not installed.");

    const publicKey = await lobstr.getPublicKey();
    const { network } = await lobstr.getNetwork();
    return { publicKey, network: mapNetwork(network) };
  }

  async disconnect(): Promise<void> {
    // LOBSTR doesn't expose programmatic disconnect
  }

  async getPublicKey(): Promise<string> {
    const lobstr = getLobstr();
    if (!lobstr) throw new Error("LOBSTR extension is not installed.");
    return lobstr.getPublicKey();
  }

  async getNetwork(): Promise<NetworkMode> {
    const lobstr = getLobstr();
    if (!lobstr) throw new Error("LOBSTR extension is not installed.");
    const { network } = await lobstr.getNetwork();
    return mapNetwork(network);
  }

  async signTransaction(xdr: string, network: NetworkMode): Promise<string> {
    const lobstr = getLobstr();
    if (!lobstr) throw new Error("LOBSTR extension is not installed.");

    const networkPassphrase =
      network === "mainnet"
        ? "Public Global Stellar Network ; September 2015"
        : "Test SDF Network ; September 2015";

    const result = await lobstr.signTransaction(xdr, { networkPassphrase });
    return result.signedTxXdr;
  }

  async signMessage(message: string): Promise<string> {
    const lobstr = getLobstr();
    if (!lobstr) throw new Error("LOBSTR extension is not installed.");
    if (!lobstr.signMessage) {
      // LOBSTR doesn't support signMessage in all versions — sign as a tx payload
      throw new Error("LOBSTR extension does not support message signing.");
    }
    const result = await lobstr.signMessage(message);
    return result.signedMessage;
  }
}
