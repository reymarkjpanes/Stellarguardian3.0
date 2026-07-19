"use client";

/**
 * Wallet Connect UI (Req 25.3, 33.1-33.16).
 *
 * Connection-state machine (Disconnected→Connecting→Connected→Verified→Error),
 * Freighter detection with install prompt, network-mismatch warnings, and
 * verification-status badges.
 */
import { useState, useEffect, useCallback } from "react";
import type { WalletConnectionState, WalletProvider } from "@/lib/wallet/types";
import type { NetworkMode } from "@/types";

interface WalletConnectProps {
  expectedNetwork?: NetworkMode;
  onConnected?: (publicKey: string, network: NetworkMode) => void;
  onVerified?: (publicKey: string) => void;
}

export function WalletConnect({ expectedNetwork = "testnet", onConnected, onVerified }: WalletConnectProps) {
  const [state, setState] = useState<WalletConnectionState>("Disconnected");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFreighterAvailable, setIsFreighterAvailable] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"Unverified" | "Pending" | "Verified">("Unverified");

  // Detect Freighter on mount (Req 33.5)
  useEffect(() => {
    const checkAvailability = () => {
      setIsFreighterAvailable(typeof window !== "undefined" && !!window.freighterApi);
    };
    checkAvailability();
    // Recheck after a short delay (extension may inject late)
    const timer = setTimeout(checkAvailability, 2000);
    return () => clearTimeout(timer);
  }, []);

  const connect = useCallback(async () => {
    if (!window.freighterApi) {
      setError("Freighter extension not found. Please install it.");
      setState("Error");
      return;
    }

    setState("Connecting");
    setError(null);

    try {
      const key = await window.freighterApi.getPublicKey();
      const rawNetwork = await window.freighterApi.getNetwork();
      const detectedNetwork: NetworkMode = rawNetwork.toLowerCase().includes("public") ? "mainnet" : "testnet";

      setPublicKey(key);
      setNetwork(detectedNetwork);
      setState("Connected");

      // Network mismatch warning (Req 33.8)
      if (detectedNetwork !== expectedNetwork) {
        setError(`Network mismatch: wallet is on ${detectedNetwork}, expected ${expectedNetwork}.`);
      }

      onConnected?.(key, detectedNetwork);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet.");
      setState("Error");
    }
  }, [expectedNetwork, onConnected]);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setNetwork(null);
    setState("Disconnected");
    setVerificationStatus("Unverified");
    setError(null);
  }, []);

  const verify = useCallback(async () => {
    if (!publicKey) return;

    setVerificationStatus("Pending");

    try {
      // Request challenge
      const challengeRes = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey }),
      });

      if (!challengeRes.ok) {
        const err = await challengeRes.json();
        throw new Error(err.error?.message ?? "Challenge request failed.");
      }

      const { data: { challengeId, nonce } } = await challengeRes.json();

      // Sign the nonce with Freighter
      if (!window.freighterApi) throw new Error("Freighter not available.");
      const signature = await window.freighterApi.signMessage(nonce);

      // Verify signature
      const verifyRes = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, signature }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error?.message ?? "Verification failed.");
      }

      setVerificationStatus("Verified");
      setState("Verified");
      onVerified?.(publicKey);
    } catch (err) {
      setVerificationStatus("Unverified");
      setError(err instanceof Error ? err.message : "Verification failed.");
    }
  }, [publicKey, onVerified]);

  // Render based on state
  if (isFreighterAvailable === false) {
    return (
      <div className="rounded-lg border border-neutral-200 p-4 text-center">
        <p className="text-sm text-neutral-600">Freighter wallet extension not detected.</p>
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm font-medium text-neutral-900 underline"
        >
          Install Freighter
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {error}
        </div>
      )}

      {state === "Disconnected" && (
        <button
          onClick={connect}
          className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
        >
          Connect Freighter Wallet
        </button>
      )}

      {state === "Connecting" && (
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          <span className="text-sm text-neutral-500">Connecting…</span>
        </div>
      )}

      {(state === "Connected" || state === "Verified") && publicKey && (
        <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500">Connected wallet</p>
              <p className="font-mono text-sm">
                {publicKey.slice(0, 8)}…{publicKey.slice(-6)}
              </p>
            </div>
            <VerificationBadge status={verificationStatus} />
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            {network}
          </div>

          <div className="flex gap-2">
            {verificationStatus !== "Verified" && (
              <button
                onClick={verify}
                disabled={verificationStatus === "Pending"}
                className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
              >
                {verificationStatus === "Pending" ? "Verifying…" : "Verify Ownership"}
              </button>
            )}
            <button
              onClick={disconnect}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {state === "Error" && (
        <button
          onClick={connect}
          className="w-full rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50"
        >
          Retry Connection
        </button>
      )}
    </div>
  );
}

function VerificationBadge({ status }: { status: "Unverified" | "Pending" | "Verified" }) {
  const styles = {
    Unverified: "bg-neutral-100 text-neutral-600",
    Pending: "bg-amber-100 text-amber-700",
    Verified: "bg-green-100 text-green-700",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
