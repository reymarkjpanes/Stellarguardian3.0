"use client";

/**
 * Multi-wallet Connect UI (Req 25.2, 25.3, 33.1-33.16).
 *
 * Discovers all available wallet extensions at runtime and lets the user
 * pick which one to connect. Currently supports Freighter and xBull.
 *
 * Flow:
 * 1. Component mounts → scans for available adapters
 * 2. User picks a wallet → adapter.connect() is called
 * 3. Confirm screen shows full address + network before linking
 * 4. "Confirm & Link" → upserts wallet row in the database
 * 5. onVerified callback fires
 */
import { useState, useCallback, useEffect } from "react";
import type { NetworkMode } from "@/types";
import type { WalletAdapter, WalletProvider } from "@/lib/wallet/types";
import { createBrowserClient } from "@/lib/supabase/client";

type FlowStep = "scanning" | "pick" | "connecting" | "confirm" | "linking" | "done" | "error";

interface WalletConnectProps {
  expectedNetwork?: NetworkMode;
  onVerified?: (publicKey: string) => void;
}

/** Provider metadata for display. */
const PROVIDER_META: Record<
  WalletProvider,
  { label: string; icon: string; installUrl: string; description: string }
> = {
  Freighter: {
    label: "Freighter",
    icon: "🚀",
    installUrl: "https://www.freighter.app/",
    description: "Official Stellar wallet by SDF",
  },
  xBull: {
    label: "xBull",
    icon: "🐂",
    installUrl: "https://xbull.app/",
    description: "Feature-rich Stellar browser wallet",
  },
  Albedo: {
    label: "Albedo",
    icon: "🔐",
    installUrl: "https://albedo.link/",
    description: "Web-based Stellar signer",
  },
  Rabet: {
    label: "Rabet",
    icon: "🌐",
    installUrl: "https://rabet.io/",
    description: "Stellar browser extension wallet",
  },
};

export function WalletConnect({ expectedNetwork = "testnet", onVerified }: WalletConnectProps) {
  const [step, setStep] = useState<FlowStep>("scanning");
  const [available, setAvailable] = useState<WalletAdapter[]>([]);
  const [allProviders, setAllProviders] = useState<WalletProvider[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState<WalletAdapter | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Scan for available wallets on mount
  useEffect(() => {
    async function scan() {
      const { getAvailableAdapters, getAllAdapters } = await import("@/lib/wallet/registry");
      const [found, all] = await Promise.all([getAvailableAdapters(), getAllAdapters()]);
      setAvailable(found);
      setAllProviders(all.map((a) => a.provider));
      setStep("pick");
    }
    scan();
  }, []);

  // Step 1: User picks a wallet — connect immediately
  const handlePick = useCallback(
    async (adapter: WalletAdapter) => {
      setSelectedAdapter(adapter);
      setStep("connecting");
      setError(null);

      try {
        const { publicKey: key, network: net } = await adapter.connect();
        setPublicKey(key);
        setNetwork(net);
        setStep("confirm");

        if (net !== expectedNetwork) {
          setError(
            `Network mismatch: ${adapter.provider} is on ${net}, app expects ${expectedNetwork}. Switch your wallet to ${expectedNetwork} and try again.`,
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `Failed to connect ${adapter.provider}. Make sure it's installed and unlocked.`,
        );
        setStep("error");
      }
    },
    [expectedNetwork],
  );

  // Step 2: User confirmed — save to DB
  const confirmAndLink = useCallback(async () => {
    if (!publicKey || !network || !selectedAdapter) return;
    setStep("linking");
    setError(null);

    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { error: walletError } = await supabase.from("wallets").upsert(
        {
          user_id: user.id,
          public_key: publicKey,
          provider: selectedAdapter.provider,
          verification_status: "Verified",
          verified_at: new Date().toISOString(),
          network_mode: network,
        },
        { onConflict: "user_id,public_key" },
      );

      if (walletError) throw new Error(walletError.message);

      setStep("done");
      setTimeout(() => onVerified?.(publicKey), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link wallet.");
      setStep("error");
    }
  }, [publicKey, network, selectedAdapter, onVerified]);

  const reset = useCallback(() => {
    setSelectedAdapter(null);
    setPublicKey(null);
    setNetwork(null);
    setError(null);
    setStep("pick");
  }, []);

  // ── Scanning ──────────────────────────────────────────────────────────────
  if (step === "scanning") {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-[var(--text-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        Detecting wallets…
      </div>
    );
  }

  // ── Wallet picker ─────────────────────────────────────────────────────────
  if (step === "pick") {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-[color-mix(in_srgb,var(--error)_40%,transparent)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error)]">
            {error}
          </div>
        )}

        <p className="text-xs text-[var(--text-muted)]">Select a wallet to connect</p>

        <div className="space-y-2">
          {allProviders.map((provider) => {
            const meta = PROVIDER_META[provider];
            const adapter = available.find((a) => a.provider === provider);
            const isInstalled = !!adapter;

            return (
              <button
                key={provider}
                onClick={() => adapter && handlePick(adapter)}
                disabled={!isInstalled}
                className={[
                  "w-full flex items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors",
                  isInstalled
                    ? "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-muted)] cursor-pointer"
                    : "border-[var(--border)] opacity-40 cursor-not-allowed",
                ].join(" ")}
              >
                <span className="text-xl leading-none">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)]">{meta.label}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{meta.description}</p>
                </div>
                {isInstalled ? (
                  <span className="shrink-0 text-xs font-medium text-[var(--success)]">
                    Installed
                  </span>
                ) : (
                  <a
                    href={meta.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-xs text-[var(--accent)] hover:underline"
                  >
                    Install
                  </a>
                )}
              </button>
            );
          })}
        </div>

        {available.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center pt-1">
            No wallets detected. Install Freighter or xBull to continue.
          </p>
        )}
      </div>
    );
  }

  // ── Connecting ────────────────────────────────────────────────────────────
  if (step === "connecting") {
    const meta = selectedAdapter ? PROVIDER_META[selectedAdapter.provider] : null;
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        <p className="text-sm text-[var(--text-muted)]">
          Waiting for {meta?.label ?? "wallet"} approval…
        </p>
        <p className="text-xs text-[var(--text-muted)]">Check your browser extension popup</p>
      </div>
    );
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  if (step === "confirm" && publicKey && selectedAdapter) {
    const meta = PROVIDER_META[selectedAdapter.provider];
    return (
      <div className="card p-5 space-y-4">
        {error && (
          <div className="rounded-md border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
            ⚠️ {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <div>
            <h3 className="text-sm font-medium text-[var(--text)]">{meta.label} connected</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Review the address below before linking to your account
            </p>
          </div>
        </div>

        <div className="rounded-md bg-[var(--bg-muted)] p-4 space-y-3">
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-1">Stellar Address</p>
            <p className="font-mono text-sm text-[var(--text)] break-all leading-relaxed">
              {publicKey}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">Network</p>
              <span className="inline-flex items-center gap-1.5 text-sm text-[var(--text)]">
                <span
                  className={`h-2 w-2 rounded-full ${network === "testnet" ? "bg-amber-400" : "bg-green-400"}`}
                />
                {network}
              </span>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">Provider</p>
              <span className="text-sm text-[var(--text)]">{meta.label}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={confirmAndLink}
            disabled={!!error && error.includes("mismatch")}
            className="flex-1 btn-primary rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm & Link Wallet
          </button>
          <button
            onClick={reset}
            className="rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── Linking ───────────────────────────────────────────────────────────────
  if (step === "linking") {
    return (
      <div className="card p-6 flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        <p className="text-sm text-[var(--text-muted)]">Linking wallet to your account…</p>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === "done" && publicKey && selectedAdapter) {
    const meta = PROVIDER_META[selectedAdapter.provider];
    return (
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[var(--success-bg)] flex items-center justify-center text-[var(--success)]">
            ✓
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text)]">
              {meta.label} linked successfully
            </p>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              {publicKey.slice(0, 8)}…{publicKey.slice(-6)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (step === "error") {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-[color-mix(in_srgb,var(--error)_40%,transparent)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error)]">
            {error}
          </div>
        )}
        <button
          onClick={reset}
          className="w-full rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return null;
}
