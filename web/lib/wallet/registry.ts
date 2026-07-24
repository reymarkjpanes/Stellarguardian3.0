/**
 * Wallet adapter registry (Req 25.2).
 *
 * Exposes extension points for additional wallet providers without changing
 * consumer code. Consumers call `getAdapter(provider)` or
 * `getAvailableAdapters()` rather than directly importing specific adapters.
 */
import { FreighterAdapter } from "./freighter";
import { XBullAdapter } from "./xbull";
import type { WalletAdapter, WalletProvider } from "./types";

const adapters: Map<WalletProvider, WalletAdapter> = new Map<WalletProvider, WalletAdapter>([
  ["Freighter", new FreighterAdapter()],
  ["xBull", new XBullAdapter()],
]);

/**
 * Register an additional wallet adapter. Used by future adapter
 * implementations (Albedo, Rabet) to plug into the system.
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
 * environment (i.e., their extension is installed).
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
 * Returns all registered adapters regardless of availability.
 */
export function getAllAdapters(): WalletAdapter[] {
  return [...adapters.values()];
}
