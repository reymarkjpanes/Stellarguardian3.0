"use client";

/**
 * WalletConnect — production wallet linking with SEP-10 verification.
 *
 * Flow: Connect → Challenge → Sign → Verify → Linked
 * A wallet is NOT considered linked until ownership is verified.
 * Never requests or stores private keys.
 */
import { useState, useCallback, useEffect } from "react";
import type { NetworkMode } from "@/types";
import type { WalletAdapter, WalletProvider } from "@/lib/wallet/types";

type FlowStep =
  | "idle"
  | "scanning"
  | "pick"
  | "connecting"
  | "challenging"
  | "signing"
  | "verifying"
  | "done"
  | "error";

const STEP_LABELS: Record<FlowStep, string> = {
  idle: "",
  scanning: "Detecting wallets…",
  pick: "Select a wallet",
  connecting: "Connecting to wallet…",
  challenging: "Requesting verification challenge…",
  signing: "Sign the challenge in your wallet…",
  verifying: "Verifying ownership…",
  done: "Wallet linked successfully",
  error: "Something went wrong",
};

const STEP_ORDER: FlowStep[] = [
  "connecting",
  "challenging",
  "signing",
  "verifying",
  "done",
];

interface WalletConnectProps {
  expectedNetwork?: NetworkMode;
  onVerified?: (publicKey: string) => void;
}

const PROVIDER_META: Record<
  WalletProvider,
  { label: string; icon: string; installUrl: string; description: string; type: "extension" | "web" }
> = {
  Freighter: { label: "Freighter", icon: "🚀", installUrl: "https://www.freighter.app/", description: "Official Stellar wallet by SDF", type: "extension" },
  xBull: { label: "xBull", icon: "🐂", installUrl: "https://xbull.app/", description: "Feature-rich Stellar browser wallet", type: "extension" },
  LOBSTR: { label: "LOBSTR", icon: "🦞", installUrl: "https://lobstr.co/", description: "Most popular Stellar mobile & extension wallet", type: "extension" },
  Albedo: { label: "Albedo", icon: "🔐", installUrl: "https://albedo.link/", description: "Web-based Stellar signer (no install needed)", type: "web" },
  Rabet: { label: "Rabet", icon: "🌐", installUrl: "https://rabet.io/", description: "Stellar browser extension wallet", type: "extension" },
};

export function WalletConnect({ expectedNetwork = "testnet", onVerified }: WalletConnectProps) {
  const [step, setStep] = useState<FlowStep>("scanning");
  const [available, setAvailable] = useState<WalletAdapter[]>([]);
  const [allProviders, setAllProviders] = useState<WalletProvider[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState<WalletAdapter | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Scan wallets on mount
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

  /**
   * Full connect-and-verify pipeline.
   * One click triggers: connect → challenge → sign → verify → done.
   */
  const handleConnectAndVerify = useCallback(
    async (adapter: WalletAdapter) => {
      setSelectedAdapter(adapter);
      setError(null);

      // ── Step 1: Connect ─────────────────────────────────────────────────
      setStep("connecting");
      let pk: string;
      let net: NetworkMode;
      try {
        const result = await adapter.connect();
        pk = result.publicKey;
        net = result.network;
        setPublicKey(pk);
        setNetwork(net);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Connection failed.";
        if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("declined")) {
          setError("Connection declined. Approve the request in your wallet extension.");
        } else if (msg.toLowerCase().includes("not installed")) {
          setError(`${adapter.provider} is not installed.`);
        } else {
          setError(msg);
        }
        setStep("error");
        return;
      }

      // Network check
      if (net !== expectedNetwork) {
        setError(`Network mismatch: your wallet is on ${net}, but this app uses ${expectedNetwork}. Switch your wallet network and try again.`);
        setStep("error");
        return;
      }

      // ── Step 2: Request challenge ───────────────────────────────────────
      setStep("challenging");
      let challengeId: string;
      let transaction: string;
      try {
        const res = await fetch("/api/wallets/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: pk }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? "Failed to issue challenge.");
        }
        const data = await res.json();
        challengeId = data.challengeId;
        transaction = data.transaction;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Challenge request failed.");
        setStep("error");
        return;
      }

      // ── Step 3: Sign challenge transaction ──────────────────────────────
      setStep("signing");
      let signedXdr: string;
      try {
        signedXdr = await adapter.signTransaction(transaction, net);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Signing failed.";
        if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("declined")) {
          setError("You declined to sign. Click your wallet again to retry.");
        } else {
          setError(msg);
        }
        setStep("error");
        return;
      }

      // ── Step 4: Submit verification ─────────────────────────────────────
      setStep("verifying");
      try {
        const res = await fetch("/api/wallets/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeId,
            signature: signedXdr,
            provider: adapter.provider,
            networkMode: net,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const code = body?.error?.code ?? "";
          if (code === "CHALLENGE_EXPIRED") {
            throw new Error("Challenge expired. Please try again.");
          }
          if (code === "SIGNATURE_INVALID") {
            throw new Error("Signature verification failed. Make sure you're using the correct wallet.");
          }
          throw new Error(body?.error?.message ?? "Verification failed.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed.");
        setStep("error");
        return;
      }

      // ── Step 5: Done ────────────────────────────────────────────────────
      setStep("done");
      onVerified?.(pk);
    },
    [expectedNetwork, onVerified],
  );

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
        <Spinner size={16} />
        Detecting wallets…
      </div>
    );
  }

  // ── Wallet picker ─────────────────────────────────────────────────────────
  if (step === "pick") {
    return (
      <div className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <p className="text-xs text-[var(--text-muted)]">Select a wallet to connect and verify</p>
        <div className="space-y-2">
          {allProviders.map((provider) => {
            const meta = PROVIDER_META[provider];
            const adapter = available.find((a) => a.provider === provider);
            const isInstalled = !!adapter;
            const isWebBased = meta.type === "web";
            const isClickable = isWebBased || isInstalled;
            const clickable = isClickable ? adapter ?? available.find((a) => a.provider === provider) : null;

            return (
              <button
                key={provider}
                onClick={() => clickable && handleConnectAndVerify(clickable)}
                disabled={!isClickable}
                className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  isClickable
                    ? "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-muted)] cursor-pointer"
                    : "border-[var(--border)] opacity-40 cursor-not-allowed"
                }`}
              >
                <span className="text-xl leading-none">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)]">{meta.label}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{meta.description}</p>
                </div>
                {isWebBased ? (
                  <span className="shrink-0 text-xs font-medium text-[var(--accent)]">Web</span>
                ) : isInstalled ? (
                  <span className="shrink-0 text-xs font-medium text-green-400">Installed</span>
                ) : (
                  <a
                    href={meta.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-xs text-[var(--accent)] hover:underline"
                  >
                    Install ↗
                  </a>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Progress (connecting/challenging/signing/verifying) ────────────────────
  if (["connecting", "challenging", "signing", "verifying"].includes(step)) {
    const meta = selectedAdapter ? PROVIDER_META[selectedAdapter.provider] : null;
    return (
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{meta?.icon ?? "💫"}</span>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">
              Linking {meta?.label ?? "wallet"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{STEP_LABELS[step]}</p>
          </div>
        </div>

        {/* Step progress indicator */}
        <div className="flex gap-1">
          {STEP_ORDER.slice(0, -1).map((s) => {
            const idx = STEP_ORDER.indexOf(s);
            const currentIdx = STEP_ORDER.indexOf(step);
            const state = idx < currentIdx ? "done" : idx === currentIdx ? "active" : "pending";
            return (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  state === "done"
                    ? "bg-green-500"
                    : state === "active"
                      ? "bg-[var(--accent)] animate-pulse"
                      : "bg-[var(--border)]"
                }`}
              />
            );
          })}
        </div>

        {step === "signing" && (
          <p className="text-xs text-center text-[var(--text-muted)]">
            Check your wallet extension — approve the signing request to prove ownership.
          </p>
        )}
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === "done" && publicKey && selectedAdapter) {
    const meta = PROVIDER_META[selectedAdapter.provider];
    return (
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 text-lg">
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
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className={`h-2 w-2 rounded-full ${network === "testnet" ? "bg-amber-400" : "bg-green-500"}`} />
          {network} · Ownership verified
        </div>
        <button
          onClick={reset}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          Link another wallet
        </button>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <ErrorBanner message={error ?? "An unexpected error occurred."} />
      <button
        onClick={reset}
        className="w-full rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error)]"
    >
      {message}
    </div>
  );
}
