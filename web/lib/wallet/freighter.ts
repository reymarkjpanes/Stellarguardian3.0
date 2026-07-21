/**
 * Freighter wallet adapter (Req 33.1).
 *
 * Uses the official @stellar/freighter-api package (v2+) which communicates
 * with the Freighter browser extension via Chrome extension messaging.
 */
import {
  isConnected,
  getAddress,
  getNetwork,
  signTransaction,
  signMessage,
  setAllowed,
  requestAccess,
} from "@stellar/freighter-api";
import type { NetworkMode } from "@/types";
import type { WalletAdapter } from "./types";

function mapNetwork(freighterNetwork: string): NetworkMode {
  const normalized = freighterNetwork.toLowerCase();
  if (normalized.includes("public") || normalized.includes("mainnet")) return "mainnet";
  return "testnet";
}

export class FreighterAdapter implements WalletAdapter {
  readonly provider = "Freighter" as const;

  async isAvailable(): Promise<boolean> {
    try {
      const result = await isConnected();
      return result.isConnected;
    } catch {
      return false;
    }
  }

  async connect(): Promise<{ publicKey: string; network: NetworkMode }> {
    // Request access (prompts user to allow this dApp)
    await setAllowed();
    const accessResult = await requestAccess();
    const publicKey = accessResult.address;

    const networkResult = await getNetwork();
    return { publicKey, network: mapNetwork(networkResult.network) };
  }

  async disconnect(): Promise<void> {
    // Freighter doesn't have a programmatic disconnect
  }

  async getPublicKey(): Promise<string> {
    const result = await getAddress();
    return result.address;
  }

  async getNetwork(): Promise<NetworkMode> {
    const result = await getNetwork();
    return mapNetwork(result.network);
  }

  async signTransaction(xdr: string, network: NetworkMode): Promise<string> {
    const networkPassphrase =
      network === "mainnet"
        ? "Public Global Stellar Network ; September 2015"
        : "Test SDF Network ; September 2015";

    const result = await signTransaction(xdr, { networkPassphrase });
    return result.signedTxXdr;
  }

  async signMessage(message: string, network?: NetworkMode): Promise<string> {
    const networkPassphrase =
      network === "mainnet"
        ? "Public Global Stellar Network ; September 2015"
        : "Test SDF Network ; September 2015";

    const result = await signMessage(message, {
      networkPassphrase,
    });
    if (result.signedMessage === null) {
      throw new Error("User rejected message signing.");
    }
    return typeof result.signedMessage === "string"
      ? result.signedMessage
      : Buffer.from(result.signedMessage).toString("base64");
  }
}
