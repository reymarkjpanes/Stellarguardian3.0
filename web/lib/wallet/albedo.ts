/**
 * Albedo wallet adapter.
 *
 * Uses @albedo-link/intent v0.13.0. Exact API surface confirmed from installed
 * package types at node_modules/@albedo-link/intent/src/index.d.ts:
 *
 *   publicKey({ require_existing? })
 *       → { pubkey, signed_message, signature }
 *
 *   signMessage({ message, pubkey? })           ← NO network param
 *       → { pubkey, original_message, signed_message, message_signature }
 *       NOTE: result field is `message_signature`, not `signature`
 *
 *   tx({ xdr, network?, submit? })              ← network is optional string
 *       → { xdr, tx_hash, signed_envelope_xdr, network, result }
 *
 * Albedo is web-based — no browser extension needed. The wallet picker shows
 * it with a "Web" badge. isAvailable() returns true in all browser contexts.
 *
 * Network note: Albedo's signMessage has no network param. For tx(), Albedo
 * accepts "testnet" | "public" as the network string.
 */
import albedo from "@albedo-link/intent";
import type { NetworkMode } from "@/types";
import type { WalletAdapter } from "./types";

function toAlbedoNetwork(mode: NetworkMode): "testnet" | "public" {
  return mode === "mainnet" ? "public" : "testnet";
}

function isRejected(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("rejected") ||
    m.includes("cancelled") ||
    m.includes("canceled") ||
    m.includes("closed") ||
    m.includes("denied") ||
    m.includes("popup closed")
  );
}

export class AlbedoAdapter implements WalletAdapter {
  readonly provider = "Albedo" as const;

  /**
   * Albedo is always available — web-based, no extension needed.
   * Shown as "Web" in the picker rather than "Installed".
   */
  async isAvailable(): Promise<boolean> {
    return typeof window !== "undefined";
  }

  async connect(): Promise<{ publicKey: string; network: NetworkMode }> {
    try {
      const result = await albedo.publicKey({ require_existing: false });
      return { publicKey: result.pubkey, network: "testnet" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isRejected(msg)) throw new Error("Albedo connection was declined.");
      throw new Error(`Albedo connection failed: ${msg}`);
    }
  }

  async disconnect(): Promise<void> {
    // Albedo is stateless
  }

  async getPublicKey(): Promise<string> {
    try {
      const result = await albedo.publicKey({ require_existing: false });
      return result.pubkey;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Albedo getPublicKey failed: ${msg}`);
    }
  }

  async getNetwork(): Promise<NetworkMode> {
    // Albedo does not expose the current network — default to testnet
    return "testnet";
  }

  async signTransaction(xdr: string, network: NetworkMode): Promise<string> {
    try {
      const result = await albedo.tx({
        xdr,
        network: toAlbedoNetwork(network),
        submit: false,
      });
      return result.signed_envelope_xdr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isRejected(msg)) throw new Error("Transaction signing was declined in Albedo.");
      throw new Error(`Albedo signTransaction failed: ${msg}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async signMessage(message: string, _network?: NetworkMode): Promise<string> {
    // Albedo signMessage has no network param — verified from installed types
    try {
      const result = await albedo.signMessage({ message });
      // Result field is `message_signature` (HEX-encoded ED25519 signature)
      return result.message_signature;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isRejected(msg)) throw new Error("Message signing was declined in Albedo.");
      throw new Error(`Albedo signMessage failed: ${msg}`);
    }
  }
}
