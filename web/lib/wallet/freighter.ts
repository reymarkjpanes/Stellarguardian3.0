/**
 * Freighter wallet adapter (Req 33.1).
 *
 * Uses @stellar/freighter-api v6. Exact API surface confirmed from installed
 * package types at node_modules/@stellar/freighter-api/build/index.d.ts:
 *
 *   requestAccess()                     → { address: string } & { error? }
 *   getAddress()                        → { address: string } & { error? }
 *   getNetwork()                        → { network, networkPassphrase } & { error? }
 *   signTransaction(xdr, { networkPassphrase?, address? })
 *                                       → { signedTxXdr, signerAddress } & { error? }
 *   signMessage(msg, { networkPassphrase?, address? })
 *                                       → { signedMessage: Buffer|string|null, signerAddress } & { error? }
 *   isConnected()                       → { isConnected: boolean } & { error? }
 *   setAllowed()                        → { isAllowed: boolean } & { error? }
 *
 * NOTE: signTransaction opts use `networkPassphrase` (not `network`).
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

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

function toPassphrase(mode: NetworkMode): string {
  return mode === "mainnet" ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;
}

function mapFreighterNetwork(network: string): NetworkMode {
  const n = network.toUpperCase();
  if (n === "PUBLIC" || n.includes("MAINNET")) return "mainnet";
  return "testnet";
}

function isRejected(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("rejected") ||
    m.includes("denied") ||
    m.includes("declined") ||
    m.includes("not allowed")
  );
}

export class FreighterAdapter implements WalletAdapter {
  readonly provider = "Freighter" as const;

  async isAvailable(): Promise<boolean> {
    try {
      const result = await isConnected();
      if ("error" in result && result.error) return false;
      return result.isConnected;
    } catch {
      return false;
    }
  }

  async connect(): Promise<{ publicKey: string; network: NetworkMode }> {
    // setAllowed() prompts the user to allow this dApp — still present in v6
    const allowResult = await setAllowed();
    if (allowResult.error) {
      const msg = String(allowResult.error.message ?? allowResult.error);
      if (isRejected(msg)) throw new Error("Freighter connection was declined.");
      throw new Error(`Freighter setAllowed failed: ${msg}`);
    }

    // requestAccess() returns the selected address
    const accessResult = await requestAccess();
    if (accessResult.error) {
      const msg = String(accessResult.error.message ?? accessResult.error);
      if (isRejected(msg)) throw new Error("Freighter connection was declined.");
      throw new Error(`Freighter requestAccess failed: ${msg}`);
    }

    const publicKey = accessResult.address;
    if (!publicKey) throw new Error("Freighter did not return a public key.");

    const networkResult = await getNetwork();
    if (networkResult.error) return { publicKey, network: "testnet" };

    return {
      publicKey,
      network: mapFreighterNetwork(networkResult.network),
    };
  }

  async disconnect(): Promise<void> {
    // Freighter has no programmatic disconnect
  }

  async getPublicKey(): Promise<string> {
    const result = await getAddress();
    if (result.error) {
      throw new Error(`Freighter getAddress failed: ${String(result.error.message ?? result.error)}`);
    }
    if (!result.address) throw new Error("Freighter is not connected — no address available.");
    return result.address;
  }

  async getNetwork(): Promise<NetworkMode> {
    const result = await getNetwork();
    if (result.error) return "testnet";
    return mapFreighterNetwork(result.network);
  }

  async signTransaction(xdr: string, network: NetworkMode): Promise<string> {
    // v6 opts: { networkPassphrase?: string; address?: string }
    const result = await signTransaction(xdr, {
      networkPassphrase: toPassphrase(network),
    });

    if (result.error) {
      const msg = String(result.error.message ?? result.error);
      if (isRejected(msg)) throw new Error("Transaction signing was declined in Freighter.");
      throw new Error(`Freighter signTransaction failed: ${msg}`);
    }

    return result.signedTxXdr;
  }

  async signMessage(message: string, network?: NetworkMode): Promise<string> {
    // v6 opts: { networkPassphrase?: string; address?: string }
    const result = await signMessage(message, {
      networkPassphrase: toPassphrase(network ?? "testnet"),
    });

    if (result.error) {
      const msg = String(result.error.message ?? result.error);
      if (isRejected(msg)) throw new Error("Message signing was declined in Freighter.");
      throw new Error(`Freighter signMessage failed: ${msg}`);
    }

    if (result.signedMessage === null) {
      throw new Error("Freighter returned null — user may have cancelled signing.");
    }

    // signedMessage is Buffer or string depending on Freighter version
    return typeof result.signedMessage === "string"
      ? result.signedMessage
      : Buffer.from(result.signedMessage as Buffer).toString("base64");
  }
}
