/**
 * Wallet adapter registry (Req 25.2).
 *
 * Exposes extension points for additional wallet providers without changing
 * consumer code. Consumers call `getAdapter(provider)` or
 * `getAvailableAdapters()` rather than directly importing specific adapters.
 *
 * Supported wallets (priority order per requirements):
 *   1. Freighter — official SDF wallet
 *   2. xBull    — feature-rich extension wallet
 *   3. LOBSTR   — most popular Stellar wallet
 *   4. Albedo   — web-based signer (no install required)
 *   5. Rabet    — browser extension
 */
import { FreighterAdapter } from "./freighter";
import { XBullAdapter } from "./xbull";
import { LobstrAdapter } from "./lobstr";
import { AlbedoAdapter } from "./albedo";
import { RabetAdapter } from "./rabet";
import type { WalletAdapter, WalletProvider } from "./types";

const adapters: Map<WalletProvider, WalletAdapter> = new Map<WalletProvider, WalletAdapter>([
  ["Freighter", new FreighterAdapter()],
  ["xBull", new XBullAdapter()],
  ["LOBSTR", new LobstrAdapter()],
  ["Albedo", new AlbedoAdapter()],
  ["Rabet", new RabetAdapter()],
]);

/**
 * Register an additional wallet adapter at runtime.
 * Allows future providers to be added without modifying this file.
 */
export function registerAdapter(adapter: WalletAdapter): void {
  adapters.set(adapter.provider, adapter);
}

/**
 * Get a specific wallet adapter by provider name.
 */
export function getAdapter(provider: WalletProvider): WalletAdapter | undefined {
  return adapters.get(provider);
}

/**
 * Returns all adapters that report being available in the current
 * environment (i.e., their extension is installed / accessible).
 */
export async function getAvailableAdapters(): Promise<WalletAdapter[]> {
  const results: WalletAdapter[] = [];
  for (const adapter of adapters.values()) {
    if (await adapter.isAvailable()) {
      results.push(adapter);
    }
  }
  return results;
}

/**
 * Returns all registered adapters in priority order regardless of availability.
 * Used by the wallet picker to show install prompts for unavailable wallets.
 */
export function getAllAdapters(): WalletAdapter[] {
  return [...adapters.values()];
}
