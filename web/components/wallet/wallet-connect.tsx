"use client";

/**
 * Wallet Connect UI (Req 25.3, 33.1-33.16).
 *
 * Flow:
 * 1. Click "Connect Freighter Wallet" → calls Freighter API
 * 2. Freighter returns address → show in-app confirmation with full address
 * 3. User clicks "Confirm & Link" → saves to database
 * 4. Success state shown briefly → onVerified callback
 */
import { useState, useCallback } from "react";
import type { NetworkMode } from "@/types";
import { createBrowserClient } from "@/lib/supabase/client";

type FlowStep = "idle" | "connecting" | "confirm" | "linking" | "done" | "error";

interface WalletConnectProps {
  expectedNetwork?: NetworkMode;
  onVerified?: (publicKey: string) => void;
}

export function WalletConnect({ expectedNetwork = "testnet", onVerified }: WalletConnectProps) {
  const [step, setStep] = useState<FlowStep>("idle");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Request address from Freighter
  const connect = useCallback(async () => {
    setStep("connecting");
    setError(null);

    try {
      const { FreighterAdapter } = await import("@/lib/wallet/freighter");
      const adapter = new FreighterAdapter();
      const { publicKey: key, network: net } = await adapter.connect();

      setPublicKey(key);
      setNetwork(net);
      setStep("confirm"); // STOP here — wait for user to confirm

      if (net !== expectedNetwork) {
        setError(`Network mismatch: wallet is on ${net}, app expects ${expectedNetwork}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect. Make sure Freighter is installed and unlocked.");
      setStep("error");
    }
  }, [expectedNetwork]);

  // Step 2: User confirmed — save to database
  const confirmAndLink = useCallback(async () => {
    if (!publicKey || !network) return;
    setStep("linking");
    setError(null);

    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { error: walletError } = await supabase.from("wallets").upsert(
        {
          user_id: user.id,
          public_key: publicKey,
          provider: "Freighter",
          verification_status: "Verified",
          verified_at: new Date().toISOString(),
          network_mode: network,
        },
        { onConflict: "user_id,public_key" },
      );

      if (walletError) throw new Error(walletError.message);

      setStep("done");

      // Delay callback so user sees the success state
      setTimeout(() => {
        onVerified?.(publicKey);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link wallet.");
      setStep("error");
    }
  }, [publicKey, network, onVerified]);

  // Cancel
  const cancel = useCallback(() => {
    setPublicKey(null);
    setNetwork(null);
    setError(null);
    setStep("idle");
  }, []);

  return (
    <div className="space-y-3">
      {/* Error display */}
      {error && (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]">
          {error}
        </div>
      )}

      {/* IDLE: Show connect button */}
      {step === "idle" && (
        <button
          onClick={connect}
          className="btn-primary w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Connect Freighter Wallet
        </button>
      )}

      {/* CONNECTING: Loading spinner */}
      {step === "connecting" && (
        <div className="card p-6 flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          <p className="text-sm text-[var(--text-muted)]">Waiting for Freighter approval…</p>
          <p className="text-xs text-[var(--text-muted)]">Check your browser extension popup</p>
        </div>
      )}

      {/* CONFIRM: Show address and ask user to confirm before linking */}
      {step === "confirm" && publicKey && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[var(--accent-muted)] flex items-center justify-center">
              <span className="text-sm">🔗</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--text)]">Wallet detected</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Review the details below before linking to your account.
              </p>
            </div>
          </div>

          {/* Wallet details */}
          <div className="rounded-md bg-[var(--bg-muted)] p-4 space-y-3">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">Stellar Address</p>
              <p className="font-mono text-sm text-[var(--text)] break-all leading-relaxed">
                {publicKey}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-0.5">Network</p>
                <span className="inline-flex items-center gap-1.5 text-sm text-[var(--text)]">
                  <span className={`h-2 w-2 rounded-full ${network === "testnet" ? "bg-amber-400" : "bg-green-400"}`} />
                  {network}
                </span>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-0.5">Provider</p>
                <span className="text-sm text-[var(--text)]">Freighter</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={confirmAndLink}
              className="flex-1 btn-primary rounded-md px-4 py-2.5 text-sm font-medium transition-colors"
            >
              Confirm & Link Wallet
            </button>
            <button
              onClick={cancel}
              className="rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* LINKING: Saving to database */}
      {step === "linking" && (
        <div className="card p-6 flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          <p className="text-sm text-[var(--text-muted)]">Linking wallet to your account…</p>
        </div>
      )}

      {/* DONE: Success */}
      {step === "done" && publicKey && (
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[var(--success-bg)] flex items-center justify-center">
              <span className="text-[var(--success)]">✓</span>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Wallet linked successfully</p>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                {publicKey.slice(0, 8)}…{publicKey.slice(-6)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ERROR: With retry and install link */}
      {step === "error" && (
        <div className="space-y-3">
          <button
            onClick={() => { setError(null); setStep("idle"); }}
            className="w-full rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            Try Again
          </button>
          <p className="text-xs text-[var(--text-muted)] text-center">
            Don't have Freighter?{" "}
            <a href="https://www.freighter.app/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
              Install it here
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
