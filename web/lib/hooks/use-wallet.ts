"use client";

/**
 * useWallet — shared wallet state hook (Req 25.1-25.9, 33).
 *
 * Provides:
 * - Connection state (Disconnected, Connecting, Connected, Verified, Error)
 * - Active wallet public key and network
 * - Provider name (Freighter, xBull, LOBSTR, Albedo, Rabet)
 * - connect(provider) / disconnect() / switchWallet(provider)
 * - Active wallet persistence via sessionStorage
 *
 * Usage:
 *   const { state, connect, disconnect } = useWallet();
 *
 * Do NOT call this hook outside of the WalletProvider tree.
 */
import { useContext } from "react";
import { WalletContext } from "@/components/providers/wallet-provider";

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider.");
  }
  return context;
}
