"use client";

/**
 * WalletProvider — global wallet state context (Req 25.1-25.9).
 *
 * Provides wallet connection state to all client components.
 * Persists the active wallet provider to sessionStorage so a page
 * refresh restores the connection without requiring re-approval.
 *
 * Features:
 * - connect(provider) — connects a specific wallet
 * - disconnect()      — clears wallet state
 * - switchWallet()    — disconnects current, ready for fresh picker
 * - Active provider persisted in sessionStorage (session-scoped)
 * - Network mismatch warning (non-blocking)
 */
import React, {
  createContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { WalletAdapter, WalletProvider, WalletConnectionState } from "@/lib/wallet/types";
import type { NetworkMode } from "@/types";
import { parseBlockchainError } from "@/lib/blockchain/errors";

const SESSION_KEY = "stellar_guardian_wallet";
const EXPECTED_NETWORK: NetworkMode =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK as NetworkMode) ?? "testnet";

export interface WalletContextValue {
  connectionState: WalletConnectionState;
  publicKey: string | null;
  network: NetworkMode | null;
  provider: WalletProvider | null;
  adapter: WalletAdapter | null;
  error: string | null;
  connect: (provider: WalletProvider) => Promise<void>;
  disconnect: () => void;
  switchWallet: () => void;
  signTransaction: (xdr: string) => Promise<string>;
  isLoading: boolean;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolved wallet state — set atomically to avoid partial renders */
interface WalletSnapshot {
  adapter: WalletAdapter;
  provider: WalletProvider;
  publicKey: string;
  network: NetworkMode;
}

/** Try to silently restore a previously-used wallet without user prompts. */
async function tryRestoreWallet(
  providerName: WalletProvider,
): Promise<WalletSnapshot | null> {
  const { getAdapter } = await import("@/lib/wallet/registry");
  const walletAdapter = getAdapter(providerName);
  if (!walletAdapter) return null;

  const available = await walletAdapter.isAvailable();
  if (!available) return null;

  const pk = await walletAdapter.getPublicKey();
  if (!pk) return null;

  const net = await walletAdapter.getNetwork();
  return { adapter: walletAdapter, provider: providerName, publicKey: pk, network: net };
}

/** Attempt a full wallet connect (prompts user). */
async function attemptConnect(providerName: WalletProvider): Promise<WalletSnapshot> {
  const { getAdapter } = await import("@/lib/wallet/registry");
  const walletAdapter = getAdapter(providerName);

  if (!walletAdapter) {
    throw new Error(`${providerName} adapter is not registered.`);
  }

  const available = await walletAdapter.isAvailable();
  if (!available) {
    throw new Error(`${providerName} extension is not installed.`);
  }

  const { publicKey: pk, network: net } = await walletAdapter.connect();
  if (!pk) throw new Error(`${providerName} did not return a public key.`);

  return { adapter: walletAdapter, provider: providerName, publicKey: pk, network: net };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connectionState, setConnectionState] = useState<WalletConnectionState>("Disconnected");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkMode | null>(null);
  const [provider, setProvider] = useState<WalletProvider | null>(null);
  const [adapter, setAdapter] = useState<WalletAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /** Apply a resolved wallet snapshot atomically */
  const applySnapshot = useCallback((snap: WalletSnapshot, networkError?: string) => {
    setAdapter(snap.adapter);
    setProvider(snap.provider);
    setPublicKey(snap.publicKey);
    setNetwork(snap.network);
    setConnectionState("Connected");
    setError(networkError ?? null);
  }, []);

  // ── Session restore ────────────────────────────────────────────────────────
  // Effect only reads sessionStorage and schedules the async restore.
  // setState is called inside the Promise callback, which runs after the
  // effect body completes — satisfying react-hooks/set-state-in-effect.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return;

    let savedProvider: WalletProvider;
    try {
      ({ provider: savedProvider } = JSON.parse(saved) as { provider: WalletProvider });
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    // Schedule restore outside the effect body (Promise callback = async)
    Promise.resolve().then(() =>
      tryRestoreWallet(savedProvider)
        .then((snap) => {
          if (snap) applySnapshot(snap);
        })
        .catch(() => sessionStorage.removeItem(SESSION_KEY)),
    );
  }, [applySnapshot]);

  // ── Connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(
    async (providerName: WalletProvider) => {
      setIsLoading(true);
      setError(null);
      setConnectionState("Connecting");

      try {
        const snap = await attemptConnect(providerName);
        const networkError =
          snap.network !== EXPECTED_NETWORK
            ? `Network mismatch: your wallet is on ${snap.network}, but this app uses ${EXPECTED_NETWORK}. Switch your wallet to ${EXPECTED_NETWORK} before signing.`
            : undefined;

        applySnapshot(snap, networkError);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ provider: providerName }));
      } catch (err) {
        const parsed = parseBlockchainError(err);
        setError(parsed.userMessage);
        setConnectionState("Error");
        console.error("[WalletProvider] connect error", parsed.devMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [applySnapshot],
  );

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    adapter?.disconnect().catch(() => {});
    setAdapter(null);
    setProvider(null);
    setPublicKey(null);
    setNetwork(null);
    setConnectionState("Disconnected");
    setError(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, [adapter]);

  const switchWallet = useCallback(() => disconnect(), [disconnect]);

  // ── Sign ───────────────────────────────────────────────────────────────────
  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!adapter || !network) {
        throw new Error("No wallet connected. Connect a wallet before signing.");
      }
      return adapter.signTransaction(xdr, network);
    },
    [adapter, network],
  );

  const value: WalletContextValue = {
    connectionState,
    publicKey,
    network,
    provider,
    adapter,
    error,
    connect,
    disconnect,
    switchWallet,
    signTransaction,
    isLoading,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
