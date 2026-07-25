/**
 * Rabet wallet adapter.
 *
 * Rabet is a Stellar browser extension wallet that injects window.rabet.
 *
 * Docs: https://rabet.io/docs
 */
import type { NetworkMode } from "@/types";
import type { WalletAdapter } from "./types";

interface RabetWindow {
  getPublicKey(): Promise<{ publicKey: string }>;
  getNetworkPassphrase(): Promise<string>;
  sign(
    xdr: string,
    network: string,
  ): Promise<{ xdr: string }>;
}

declare global {
  interface Window {
    rabet?: RabetWindow;
  }
}

function getRabet(): RabetWindow | null {
  if (typeof window === "undefined") return null;
  return window.rabet ?? null;
}

/** Rabet returns the full passphrase string — map to our NetworkMode */
function mapPassphrase(passphrase: string): NetworkMode {
  if (passphrase === "Public Global Stellar Network ; September 2015") return "mainnet";
  return "testnet";
}

export class RabetAdapter implements WalletAdapter {
  readonly provider = "Rabet" as const;

  async isAvailable(): Promise<boolean> {
    return getRabet() !== null;
  }

  async connect(): Promise<{ publicKey: string; network: NetworkMode }> {
    const rabet = getRabet();
    if (!rabet) throw new Error("Rabet extension is not installed.");

    const { publicKey } = await rabet.getPublicKey();
    const passphrase = await rabet.getNetworkPassphrase();
    return { publicKey, network: mapPassphrase(passphrase) };
  }

  async disconnect(): Promise<void> {
    // Rabet doesn't expose programmatic disconnect
  }

  async getPublicKey(): Promise<string> {
    const rabet = getRabet();
    if (!rabet) throw new Error("Rabet extension is not installed.");
    const { publicKey } = await rabet.getPublicKey();
    return publicKey;
  }

  async getNetwork(): Promise<NetworkMode> {
    const rabet = getRabet();
    if (!rabet) throw new Error("Rabet extension is not installed.");
    const passphrase = await rabet.getNetworkPassphrase();
    return mapPassphrase(passphrase);
  }

  async signTransaction(xdr: string, network: NetworkMode): Promise<string> {
    const rabet = getRabet();
    if (!rabet) throw new Error("Rabet extension is not installed.");

    const networkPassphrase =
      network === "mainnet"
        ? "Public Global Stellar Network ; September 2015"
        : "Test SDF Network ; September 2015";

    const result = await rabet.sign(xdr, networkPassphrase);
    return result.xdr;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async signMessage(_message: string): Promise<string> {
    // Rabet doesn't support arbitrary message signing in its current public API.
    // The leading underscore signals intentional non-use per project convention.
    throw new Error(
      "Rabet does not support message signing. Use signTransaction for wallet verification.",
    );
  }
}
