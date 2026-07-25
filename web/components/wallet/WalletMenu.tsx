"use client";

/**
 * WalletMenu — wallet management sheet/popover.
 *
 * Shows when user clicks the WalletButton.
 * Handles:
 * - Wallet picker (when disconnected)
 * - Connected wallet details + switch/disconnect (when connected)
 * - Network mismatch warning
 * - Error state with recovery action
 */
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/hooks/use-wallet";
import { getAllAdapters, getAvailableAdapters } from "@/lib/wallet/registry";
import type { WalletAdapter, WalletProvider } from "@/lib/wallet/types";

const PROVIDER_META: Record<
  WalletProvider,
  {
    label: string;
    icon: string;
    installUrl: string;
    description: string;
    /** "extension" — needs browser install; "web" — works without install */
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

interface WalletMenuProps {
  onClose: () => void;
}

export function WalletMenu({ onClose }: WalletMenuProps) {
  const {
    connectionState,
    publicKey,
    network,
    provider,
    error,
    connect,
    disconnect,
    switchWallet,
    isLoading,
  } = useWallet();

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isConnected = connectionState === "Connected" || connectionState === "Verified";

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Focus the panel on mount for keyboard accessibility
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const handleConnect = async (walletProvider: WalletProvider) => {
    await connect(walletProvider);
  };

  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  const handleSwitch = () => {
    switchWallet();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Wallet"
      className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/40 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="mt-14 w-80 rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            {isConnected ? "Wallet" : "Connect Wallet"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close wallet menu"
            className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Error / network mismatch */}
          {error && (
            <div
              role="alert"
              className="rounded-md border border-[color-mix(in_srgb,var(--warning,oklch(0.6_0.15_85))_40%,transparent)] bg-[var(--bg-muted)] px-3 py-2.5 text-xs text-[var(--warning,oklch(0.6_0.15_85))]"
            >
              ⚠ {error}
            </div>
          )}

          {/* Connected state */}
          {isConnected && publicKey ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-[var(--bg-muted)] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none" aria-hidden="true">
                    {provider ? (PROVIDER_META[provider]?.icon ?? "💫") : "💫"}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-[var(--text)]">
                      {provider ? (PROVIDER_META[provider]?.label ?? provider) : "Wallet"}
                    </p>
                    {network && (
                      <p className="text-xs text-[var(--text-muted)] capitalize">{network}</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-0.5">Address</p>
                  <code className="block text-xs font-mono text-[var(--text)] break-all leading-relaxed">
                    {publicKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(publicKey)}
                    className="mt-1 text-xs text-[var(--accent)] hover:underline focus:outline-none"
                    aria-label="Copy wallet address to clipboard"
                  >
                    Copy address
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSwitch}
                  className="flex-1 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                >
                  Switch Wallet
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex-1 rounded-md border border-[color-mix(in_srgb,var(--error,oklch(0.55_0.2_25))_40%,transparent)] px-3 py-2 text-xs font-medium text-[var(--error,oklch(0.55_0.2_25))] hover:bg-[var(--error-bg,oklch(0.98_0.01_25))] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--error,oklch(0.55_0.2_25))]"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            /* Wallet picker */
            <WalletPicker onConnect={handleConnect} isLoading={isLoading} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Wallet Picker ─────────────────────────────────────────────────────────────

interface WalletPickerProps {
  onConnect: (provider: WalletProvider) => Promise<void>;
  isLoading: boolean;
}

function WalletPicker({ onConnect, isLoading }: WalletPickerProps) {
  const allAdapters: WalletAdapter[] = getAllAdapters();
  const [available, setAvailable] = useState<Set<WalletProvider>>(new Set());
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    getAvailableAdapters().then((adapters) => {
      setAvailable(new Set(adapters.map((a) => a.provider)));
      setScanning(false);
    });
  }, []);

  if (scanning) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-[var(--text-muted)]">
        <span className="h-3 w-3 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" aria-hidden="true" />
        Detecting wallets…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-muted)]">Select a wallet to connect</p>
      {allAdapters.map((adapter) => {
        const meta = PROVIDER_META[adapter.provider];
        const isExtensionInstalled = available.has(adapter.provider);
        const isWebBased = meta.type === "web";
        // Web-based wallets are always clickable; extension wallets only if installed
        const isClickable = isWebBased || isExtensionInstalled;

        return (
          <button
            key={adapter.provider}
            onClick={() => isClickable && onConnect(adapter.provider)}
            disabled={!isClickable || isLoading}
            className={[
              "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
              isClickable && !isLoading
                ? "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-muted)] cursor-pointer"
                : "border-[var(--border)] opacity-40 cursor-not-allowed",
            ].join(" ")}
            aria-label={
              isClickable
                ? `Connect with ${meta.label}`
                : `${meta.label} is not installed`
            }
          >
            <span className="text-xl leading-none" aria-hidden="true">
              {meta.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text)]">{meta.label}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{meta.description}</p>
            </div>

            {/* Status badge */}
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

      {available.size === 0 && (
        <p className="text-xs text-[var(--text-muted)] text-center pt-1">
          No extensions detected. Install Freighter or LOBSTR, or use Albedo (web-based).
        </p>
      )}
    </div>
  );
}
