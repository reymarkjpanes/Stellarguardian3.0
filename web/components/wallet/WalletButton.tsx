"use client";

/**
 * WalletButton — compact connected wallet display for the nav bar.
 *
 * Shows:
 * - Connected: provider icon + truncated public key + network badge
 * - Disconnected: "Connect Wallet" button
 * - Connecting: spinner
 *
 * Clicking opens the WalletMenu sheet/popover.
 */
import { useState } from "react";
import { useWallet } from "@/lib/hooks/use-wallet";
import { WalletMenu } from "./WalletMenu";

const NETWORK_COLORS = {
  testnet: "bg-amber-400",
  mainnet: "bg-green-500",
};

const PROVIDER_ICONS: Record<string, string> = {
  Freighter: "🚀",
  xBull: "🐂",
  LOBSTR: "🦞",
  Albedo: "🔐",
  Rabet: "🌐",
};

export function WalletButton() {
  const { connectionState, publicKey, network, provider, isLoading } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  const isConnected = connectionState === "Connected" || connectionState === "Verified";

  if (isLoading || connectionState === "Connecting") {
    return (
      <button
        disabled
        aria-label="Connecting wallet…"
        className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] opacity-60 cursor-not-allowed"
      >
        <span className="h-3 w-3 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" aria-hidden="true" />
        Connecting…
      </button>
    );
  }

  if (!isConnected || !publicKey) {
    return (
      <>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Connect wallet"
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--bg-muted)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Connect Wallet
        </button>
        {menuOpen && <WalletMenu onClose={() => setMenuOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setMenuOpen(true)}
        aria-label={`Connected: ${provider} wallet, address ${publicKey}`}
        className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)] hover:bg-[var(--bg-muted)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        {/* Provider icon */}
        <span aria-hidden="true" className="text-base leading-none">
          {provider ? PROVIDER_ICONS[provider] ?? "💫" : "💫"}
        </span>

        {/* Truncated address */}
        <span className="font-mono text-xs text-[var(--text)]">
          {publicKey.slice(0, 4)}…{publicKey.slice(-4)}
        </span>

        {/* Network badge */}
        {network && (
          <span className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${NETWORK_COLORS[network] ?? "bg-gray-400"}`}
            />
            <span className="text-xs text-[var(--text-muted)] capitalize">{network}</span>
          </span>
        )}
      </button>
      {menuOpen && <WalletMenu onClose={() => setMenuOpen(false)} />}
    </>
  );
}
