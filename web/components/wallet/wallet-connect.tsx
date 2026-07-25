"use client";

/**
 * WalletConnect — full wallet link flow with challenge-response verification.
 * (Req 5.1-5.7, 25.2, 25.3, 33.1-33.16)
 *
 * This component handles the dedicated wallet-linking flow (settings page,
 * onboarding). For the nav-bar quick connect, use <WalletButton>.
 *
 * Flow:
 *   1. Scan available wallets
 *   2. User picks wallet → adapter.connect() → get public key + network
 *   3. Confirm screen (shows full address, network)
 *   4. "Verify Ownership" → POST /api/wallets/challenge → nonce issued
 *   5. User signs nonce with wallet → POST /api/wallets/verify → verified
 *   6. onVerified(publicKey) fires
 *
 * Challenge-response proves key ownership before writing to DB.
 */
import { useState, useCallback, useEffect } from "react";
import type { NetworkMode } from "@/types";
import type { WalletAdapter, WalletProvider } from "@/lib/wallet/types";

type FlowStep =
  | "scanning"
  | "pick"
  | "connecting"
  | "confirm"
  | "verifying"
  | "signing"
  | "submitting"
  | "done"
  | "error";

interface WalletConnectProps {
  expectedNetwork?: NetworkMode;
  onVerified?: (publicKey: string) => void;
}

const PROVIDER_META: Record<
  WalletProvider,
  {
    label: string;
    icon: string;
    installUrl: string;
    description: string;
    type: "extension" | "web";
  }
> = {
  Freighter: {
    label: "Freighter",
    icon: "🚀",
    installUrl: "https://www.freighter.app/",
    description: "Official Stellar wallet by SDF",
    type: "extension",
  },
  xBull: {
    label: "xBull",
    icon: "🐂",
    installUrl: "https://xbull.app/",
    description: "Feature-rich Stellar browser wallet",
    type: "extension",
  },
  LOBSTR: {
    label: "LOBSTR",
    icon: "🦞",
    installUrl: "https://lobstr.co/",
    description: "Most popular Stellar mobile & extension wallet",
    type: "extension",
  },
  Albedo: {
    label: "Albedo",
    icon: "🔐",
    installUrl: "https://albedo.link/",
    description: "Web-based Stellar signer (no install needed)",
    type: "web",
  },
  Rabet: {
    label: "Rabet",
    icon: "🌐",
    installUrl: "https://rabet.io/",
    description: "Stellar browser extension wallet",
    type: "extension",
  },
};

export function WalletConnect({
  expectedNetwork = "testnet",
  onVerified,
}: WalletConnectProps) {
  const [step, setStep] = useState<FlowStep>("scanning");
  const [available, setAvailable] = useState<WalletAdapter[]>([]);
  const [allProviders, setAllProviders] = useState<WalletProvider[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState<WalletAdapter | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Scan on mount
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

  // Step 1: Connect wallet
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
            `Network mismatch: ${adapter.provider} is on ${net}, but this app uses ${expectedNetwork}. ` +
              `Switch your wallet to ${expectedNetwork} and try again.`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Connection failed.";
        // Classify error for better messaging
        if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("declined")) {
          setError("Connection declined. Click your wallet extension and approve the request.");
        } else if (msg.toLowerCase().includes("not installed") || msg.toLowerCase().includes("is not")) {
          setError(`${adapter.provider} is not installed. Install it from ${PROVIDER_META[adapter.provider]?.installUrl ?? "the extension store"}.`);
        } else {
          setError(msg);
        }
        setStep("error");
      }
    },
    [expectedNetwork],
  );

  // Step 2: Issue challenge + sign + verify
  const handleVerify = useCallback(async () => {
    if (!publicKey || !selectedAdapter || !network) return;

    setStep("verifying");
    setError(null);

    try {
      // 2a. Issue challenge
      const challengeRes = await fetch("/api/wallets/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey }),
      });

      if (!challengeRes.ok) {
        const body = await challengeRes.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to issue challenge.");
      }

      const { challengeId, nonce } = await challengeRes.json();

      // 2b. Sign the nonce with the wallet
      setStep("signing");
      let signature: string;
      try {
        signature = await selectedAdapter.signMessage(nonce, network);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Signing failed.";
        if (
          msg.toLowerCase().includes("rejected") ||
          msg.toLowerCase().includes("declined") ||
          msg.toLowerCase().includes("user rejected")
        ) {
          throw new Error("You declined to sign the verification message. Click Verify again and approve in your wallet.");
        }
        if (msg.toLowerCase().includes("does not support")) {
          // Rabet fallback: use signTransaction with a challenge memo
          throw new Error(
            `${selectedAdapter.provider} does not support message signing. Use Freighter, xBull, or LOBSTR for wallet verification.`,
          );
        }
        throw err;
      }

      // 2c. Submit verification
      setStep("submitting");
      const verifyRes = await fetch("/api/wallets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, signature }),
      });

      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        if (verifyRes.status === 400) {
          const code = body?.error?.code ?? "";
          if (code === "CHALLENGE_EXPIRED") {
            throw new Error("Verification challenge expired. Click Verify to request a new one.");
          }
          if (code === "SIGNATURE_INVALID") {
            throw new Error(
              "Signature verification failed. Make sure you signed with the correct wallet and try again.",
            );
          }
        }
        throw new Error(body?.error?.message ?? "Wallet verification failed.");
      }

      setStep("done");
      setTimeout(() => onVerified?.(publicKey), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setStep("error");
    }
  }, [publicKey, selectedAdapter, network, onVerified]);

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
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" aria-hidden="true" />
        Detecting wallets…
      </div>
    );
  }

  // ── Wallet picker ─────────────────────────────────────────────────────────
  if (step === "pick") {
    return (
      <div className="space-y-3">
        {error && (
          <div role="alert" className="rounded-md border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error)]">
            {error}
          </div>
        )}
        <p className="text-xs text-[var(--text-muted)]">Select a wallet to connect and verify</p>
        <div className="space-y-2">
          {allProviders.map((provider) => {
            const meta = PROVIDER_META[provider];
            const adapter = available.find((a) => a.provider === provider);
            const isExtensionInstalled = !!adapter;
            const isWebBased = meta.type === "web";
            // Web-based wallets are always clickable; find adapter from getAllAdapters
            const clickableAdapter = isWebBased
              ? available.find((a) => a.provider === provider) ??
                // Web adapters report isAvailable=true so should be in available[]
                // If somehow missing, we still need a reference — skip gracefully
                null
              : adapter;
            const isClickable = isWebBased ? true : isExtensionInstalled;

            return (
              <button
                key={provider}
                onClick={() => clickableAdapter && handlePick(clickableAdapter)}
                disabled={!isClickable}
                className={[
                  "w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                  isClickable
                    ? "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-muted)] cursor-pointer"
                    : "border-[var(--border)] opacity-40 cursor-not-allowed",
                ].join(" ")}
                aria-label={isClickable ? `Connect ${meta.label}` : `${meta.label} not installed`}
              >
                <span className="text-xl leading-none" aria-hidden="true">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)]">{meta.label}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{meta.description}</p>
                </div>
                {isWebBased ? (
                  <span className="shrink-0 text-xs font-medium text-[var(--accent)]">
                    Web
                  </span>
                ) : isExtensionInstalled ? (
                  <span className="shrink-0 text-xs font-medium text-[var(--success,oklch(0.55_0.15_145))]">
                    Installed
                  </span>
                ) : (
                  <a
                    href={meta.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-xs text-[var(--accent)] hover:underline focus:outline-none"
                    aria-label={`Install ${meta.label} (opens in new tab)`}
                  >
                    Install ↗
                  </a>
                )}
              </button>
            );
          })}
        </div>
        {available.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center pt-1">
            No wallets detected. Install Freighter or LOBSTR to continue.
          </p>
        )}
      </div>
    );
  }

  // ── Connecting ────────────────────────────────────────────────────────────
  if (step === "connecting") {
    const meta = selectedAdapter ? PROVIDER_META[selectedAdapter.provider] : null;
    const isWebBased = meta?.type === "web";
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" aria-hidden="true" />
        <p className="text-sm text-[var(--text-muted)]">
          Waiting for {meta?.label ?? "wallet"} approval…
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          {isWebBased
            ? "A popup window will open — approve the request there"
            : "Check your browser extension popup"}
        </p>
      </div>
    );
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  if (step === "confirm" && publicKey && selectedAdapter) {
    const meta = PROVIDER_META[selectedAdapter.provider];
    const hasNetworkError = error?.includes("mismatch");

    return (
      <div className="card p-5 space-y-4">
        {error && (
          <div role="alert" className="rounded-md border border-[color-mix(in_srgb,var(--warning,oklch(0.6_0.15_85))_30%,transparent)] bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--warning,oklch(0.6_0.15_85))]">
            ⚠ {error}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none" aria-hidden="true">{meta.icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">{meta.label} connected</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Sign a message to prove ownership before linking
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-[var(--bg-muted)] p-4 space-y-3">
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
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    network === "testnet" ? "bg-amber-400" : "bg-green-500"
                  }`}
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
            onClick={handleVerify}
            disabled={hasNetworkError}
            className="flex-1 btn-primary rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Verify Ownership
          </button>
          <button
            onClick={reset}
            className="rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors focus:outline-none"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── In-progress verification steps ───────────────────────────────────────
  if (step === "verifying" || step === "signing" || step === "submitting") {
    const messages: Record<typeof step, string> = {
      verifying: "Issuing verification challenge…",
      signing:   "Waiting for signature in your wallet…",
      submitting: "Submitting verification…",
    };
    const hints: Record<typeof step, string | null> = {
      verifying: null,
      signing:   "Check your wallet extension popup and approve the signing request",
      submitting: null,
    };
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" aria-hidden="true" />
        <p className="text-sm text-[var(--text-muted)]">{messages[step]}</p>
        {hints[step] && (
          <p className="text-xs text-[var(--text-muted)]">{hints[step]}</p>
        )}
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === "done" && publicKey && selectedAdapter) {
    const meta = PROVIDER_META[selectedAdapter.provider];
    return (
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-full bg-[var(--success-bg,oklch(0.97_0.02_145))] flex items-center justify-center text-[var(--success,oklch(0.55_0.15_145))] font-bold"
            aria-hidden="true"
          >
            ✓
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text)]">
              {meta.label} verified and linked
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
  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-md border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error)]">
          {error}
        </div>
      )}
      <button
        onClick={reset}
        className="w-full rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        Try Again
      </button>
    </div>
  );
}
