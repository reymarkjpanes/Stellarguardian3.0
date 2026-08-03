/**
 * Event Sponsors Page — C5 (Phase 3)
 *
 * All members can view the sponsors list.
 * Organizers can add sponsors (name, tier, contribution amount).
 * Sponsors see their own contribution details prominently.
 * Sponsors with a wallet can self-serve fund the escrow via admin_deposit (Phase 3.2).
 *
 * Data: GET /api/events/[id]/sponsors
 * Create: POST /api/events/[id]/sponsors (organizer only)
 * Fund: POST /api/escrow/[escrowId]/build-admin-deposit → sign → POST /api/stellar/submit
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

interface Sponsor {
  id: string;
  name: string;
  logo_url: string | null;
  contribution_amount: number;
  tier: "platinum" | "gold" | "silver" | "bronze";
  user_id: string | null;
  created_at: string;
}

/** Escrow state relevant to whether deposit is available */
interface EscrowInfo {
  id: string;
  status: string;
  expected_balance: string;
  contract_address: string | null;
}

type DepositStep =
  | "idle"
  | "connecting"
  | "connected"
  | "building"
  | "signing"
  | "submitting"
  | "done"
  | "error";

const TIER_META: Record<
  Sponsor["tier"],
  { label: string; color: string; ring: string; order: number }
> = {
  platinum: { label: "Platinum", color: "text-slate-300", ring: "border-slate-300", order: 1 },
  gold: { label: "Gold", color: "text-yellow-500", ring: "border-yellow-400", order: 2 },
  silver: { label: "Silver", color: "text-slate-400", ring: "border-slate-400", order: 3 },
  bronze: { label: "Bronze", color: "text-amber-600", ring: "border-amber-500", order: 4 },
};

export default function SponsorsPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isSponsor, setIsSponsor] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [escrow, setEscrow] = useState<EscrowInfo | null>(null);

  // Sponsor deposit state (Phase 3.2)
  const [depositStep, setDepositStep] = useState<DepositStep>("idle");
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositWallet, setDepositWallet] = useState<{ provider: string; publicKey: string } | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null);

  // Create form
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState("");
  const [formTier, setFormTier] = useState<Sponsor["tier"]>("bronze");
  const [formAmount, setFormAmount] = useState("");
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership } = await supabase
        .from("event_members")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      // Sponsors page is visible to all event members + organizer
      if (!membership) {
        router.push(`/events/${eventId}`);
        return;
      }

      const [sponsorsRes, escrowRes] = await Promise.all([
        fetch(`/api/events/${eventId}/sponsors`),
        fetch(`/api/events/${eventId}/escrow`).catch(() => null),
      ]);
      const { data } = await sponsorsRes.json();

      // Fetch escrow info directly from Supabase (for deposit eligibility)
      const { data: escrowData } = await supabase
        .from("escrow_accounts")
        .select("id, status, expected_balance, contract_address")
        .eq("event_id", eventId)
        .maybeSingle();

      if (!ignore) {
        setSponsors(
          (data ?? []).sort(
            (a: Sponsor, b: Sponsor) => TIER_META[a.tier].order - TIER_META[b.tier].order,
          ),
        );
        setIsOrganizer(membership.role === "Organizer");
        setIsSponsor(membership.role === "Sponsor");
        setCurrentUserId(user.id);
        if (escrowData) setEscrow(escrowData as EscrowInfo);
        setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [eventId, router]);

  // ── Sponsor deposit handlers (Phase 3.2) ──────────────────────────────────

  async function handleConnectWallet() {
    setDepositStep("connecting");
    setDepositError(null);
    try {
      const { getAvailableAdapters } = await import("@/lib/wallet/registry");
      const adapters = await getAvailableAdapters();
      if (adapters.length === 0) {
        throw new Error("No Stellar wallet detected. Install Freighter, xBull, or LOBSTR.");
      }
      const adapter = adapters[0]!;
      const { publicKey } = await adapter.connect();
      setDepositWallet({ provider: adapter.provider, publicKey });
      setDepositStep("connected");
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : "Wallet connection failed.");
      setDepositStep("error");
    }
  }

  async function handleSponsorDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!depositWallet || !escrow || !depositAmount) return;

    const amountXlm = parseFloat(depositAmount);
    if (isNaN(amountXlm) || amountXlm <= 0) {
      setDepositError("Enter a valid amount greater than 0.");
      return;
    }

    const amountStroops = BigInt(Math.round(amountXlm * 10_000_000)).toString();
    setDepositError(null);

    try {
      // Step 1: Build admin_deposit XDR (platform pre-signs server-side)
      setDepositStep("building");
      const buildRes = await fetch(`/api/escrow/${escrow.id}/build-admin-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsorPublicKey: depositWallet.publicKey,
          amountStroops,
        }),
      });

      if (!buildRes.ok) {
        const e = await buildRes.json();
        throw new Error(e.error?.message ?? "Failed to build deposit transaction.");
      }
      const { xdr: partiallySignedXdr } = await buildRes.json();

      // Step 2: Sponsor wallet adds their signature
      setDepositStep("signing");
      const { getAdapter } = await import("@/lib/wallet/registry");
      const adapter = getAdapter(depositWallet.provider as import("@/lib/wallet/types").WalletProvider);
      if (!adapter) throw new Error("Wallet disconnected. Reconnect and try again.");

      // Determine network from escrow (contract_address presence = testnet typically)
      const networkMode: "testnet" | "mainnet" =
        process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
      const signedXdr = await adapter.signTransaction(partiallySignedXdr, networkMode);

      // Step 3: Submit the fully-signed transaction
      setDepositStep("submitting");
      const submitRes = await fetch("/api/stellar/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr }),
      });

      if (!submitRes.ok) {
        const e = await submitRes.json();
        throw new Error(e.error ?? "Transaction submission failed.");
      }
      const { hash, successful } = await submitRes.json();

      if (!successful) throw new Error("Transaction submitted but not confirmed on-chain.");

      setDepositTxHash(hash);
      setDepositStep("done");
      setDepositAmount("");

      // Refresh sponsors list to reflect updated contribution
      const updatedRes = await fetch(`/api/events/${eventId}/sponsors`);
      const { data } = await updatedRes.json();
      setSponsors(
        (data ?? []).sort(
          (a: Sponsor, b: Sponsor) => TIER_META[a.tier].order - TIER_META[b.tier].order,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deposit failed.";
      if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel")) {
        setDepositStep("connected");
        setDepositError("Transaction cancelled. You can try again.");
      } else {
        setDepositError(msg);
        setDepositStep("error");
      }
    }
  }

  function resetDeposit() {
    setDepositStep("idle");
    setDepositError(null);
    setDepositTxHash(null);
    setDepositWallet(null);
    setDepositAmount("");
  }

  // ── Add sponsor handler ────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setAdding(true);
    setAddError(null);

    const body: Record<string, unknown> = {
      name: formName.trim(),
      tier: formTier,
    };
    if (formAmount) body.contribution_amount = Number(formAmount);
    if (formLogoUrl.trim()) body.logo_url = formLogoUrl.trim();

    const res = await fetch(`/api/events/${eventId}/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) {
      setAddError(json.error?.message ?? "Failed to add sponsor.");
    } else {
      setSponsors((prev) =>
        [...prev, json.data].sort(
          (a: Sponsor, b: Sponsor) => TIER_META[a.tier].order - TIER_META[b.tier].order,
        ),
      );
      setShowAdd(false);
      setFormName("");
      setFormTier("bronze");
      setFormAmount("");
      setFormLogoUrl("");
    }
    setAdding(false);
  }

  const totalContributions = sponsors.reduce((s, sp) => s + (sp.contribution_amount ?? 0), 0);

  const inputCls =
    "w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4 animate-pulse">
        <div className="h-8 w-40 bg-[var(--bg-muted)] rounded" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card h-20 bg-[var(--bg-muted)]" />
        ))}
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Sponsors</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Organizations and individuals backing this event.
          </p>
        </div>
        {isOrganizer && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Add Sponsor
          </button>
        )}
      </div>

      {/* Global error */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 flex justify-between"
        >
          <p className="text-sm text-[var(--error)]">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-[var(--error)] hover:underline"
          >
            ✕
          </button>
        </div>
      )}

      {/* Total contributions */}
      {sponsors.length > 0 && (
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Total Contributions
            </p>
            <p className="text-2xl font-bold text-[var(--text)] mt-0.5">
              {totalContributions.toLocaleString()} XLM
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--text-muted)]">
              {sponsors.length} sponsor{sponsors.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Sponsor deposit panel — visible to Sponsor role when escrow is fundable (Phase 3.2) */}
      {isSponsor && escrow && (escrow.status === "PendingFunding" || escrow.status === "PartiallyFunded") && (
        <div className="card p-5 space-y-4 border-2 border-[var(--accent)]/30">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Fund the Escrow</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Contribute XLM directly to the Soroban escrow contract via your Stellar wallet.
              Target: <strong>{Number(escrow.expected_balance).toLocaleString()} XLM</strong>
            </p>
          </div>

          {depositStep === "done" && depositTxHash && (
            <div role="status" className="rounded-md border border-[var(--success-bg)] bg-[var(--success-bg)] px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-[var(--success,#16a34a)]">✓ Deposit confirmed on-chain!</p>
              <p className="text-xs text-[var(--text-muted)]">
                Tx:{" "}
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${depositTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono hover:underline"
                >
                  {depositTxHash.slice(0, 16)}…
                </a>
              </p>
              <button onClick={resetDeposit} className="text-xs text-[var(--accent)] hover:underline mt-1">
                Make another deposit
              </button>
            </div>
          )}

          {depositError && (
            <div role="alert" className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-3 py-2 flex justify-between items-center">
              <p className="text-xs text-[var(--error)]">{depositError}</p>
              <button onClick={() => { setDepositError(null); setDepositStep(depositWallet ? "connected" : "idle"); }} className="text-xs text-[var(--error)] hover:underline ml-3">✕</button>
            </div>
          )}

          {depositStep !== "done" && (
            <>
              {/* Step 1: Connect wallet */}
              {!depositWallet && depositStep !== "connecting" && (
                <button
                  onClick={handleConnectWallet}
                  className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Connect Stellar Wallet
                </button>
              )}

              {depositStep === "connecting" && (
                <p className="text-xs text-[var(--text-muted)] animate-pulse">Connecting wallet…</p>
              )}

              {/* Step 2: Enter amount and fund */}
              {depositWallet && (depositStep === "connected" || depositStep === "idle") && (
                <form onSubmit={handleSponsorDeposit} className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    {depositWallet.provider}: {depositWallet.publicKey.slice(0, 8)}…{depositWallet.publicKey.slice(-6)}
                  </div>
                  <div>
                    <label htmlFor="deposit-amount" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Amount (XLM)
                    </label>
                    <input
                      id="deposit-amount"
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="e.g. 1000"
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!depositAmount}
                    className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                  >
                    Deposit to Escrow
                  </button>
                </form>
              )}

              {(depositStep === "building" || depositStep === "signing" || depositStep === "submitting") && (
                <div className="space-y-1">
                  {[
                    { key: "building", label: "Building transaction…" },
                    { key: "signing", label: "Waiting for wallet signature…" },
                    { key: "submitting", label: "Broadcasting to Stellar…" },
                  ].map(({ key, label }) => (
                    <div key={key} className={`flex items-center gap-2 text-xs ${depositStep === key ? "text-[var(--accent)] font-medium" : "text-[var(--text-muted)]"}`}>
                      {depositStep === key ? (
                        <span className="h-3 w-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                      ) : (
                        <span className="h-3 w-3 rounded-full bg-[var(--bg-muted)]" />
                      )}
                      {label}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add sponsor form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">Add Sponsor</h2>

          {addError && (
            <div
              role="alert"
              className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]"
            >
              {addError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="sp-name"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Sponsor Name <span className="text-[var(--error)]">*</span>
              </label>
              <input
                id="sp-name"
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Stellar Development Foundation"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="sp-tier"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Tier
              </label>
              <select
                id="sp-tier"
                value={formTier}
                onChange={(e) => setFormTier(e.target.value as Sponsor["tier"])}
                className={inputCls}
              >
                <option value="platinum">Platinum</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="sp-amount"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Contribution (XLM){" "}
                <span className="font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                id="sp-amount"
                type="number"
                min="0"
                step="any"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="e.g. 5000"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="sp-logo"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Logo URL <span className="font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                id="sp-logo"
                type="url"
                value={formLogoUrl}
                onChange={(e) => setFormLogoUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={adding}
              className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {adding ? "Adding…" : "Add Sponsor"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setAddError(null);
              }}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Sponsors list */}
      {sponsors.length === 0 && !showAdd ? (
        <div className="card p-12 text-center space-y-3">
          <p className="text-sm font-medium text-[var(--text)]">No sponsors yet</p>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            {isOrganizer
              ? "Add sponsors to recognise organisations contributing to this event's prize pool."
              : "The organizer hasn't added any sponsors yet."}
          </p>
          {isOrganizer && (
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Add First Sponsor
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sponsors.map((sp) => {
            const meta = TIER_META[sp.tier];
            const isMe = sp.user_id === currentUserId;
            return (
              <div
                key={sp.id}
                className={`card p-5 flex items-center gap-5 ${
                  isMe ? `border-2 ${meta.ring}` : ""
                }`}
              >
                {/* Avatar / logo */}
                <div className="h-12 w-12 rounded-lg bg-[var(--bg-muted)] flex items-center justify-center shrink-0 overflow-hidden">
                  {sp.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sp.logo_url} alt={sp.name} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-lg font-bold text-[var(--text-muted)]">
                      {sp.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--text)] truncate">{sp.name}</p>
                    {isMe && (
                      <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-xs text-[var(--accent)] font-medium">
                        You
                      </span>
                    )}
                  </div>
                  {sp.contribution_amount > 0 && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {sp.contribution_amount.toLocaleString()} XLM contributed
                    </p>
                  )}
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold shrink-0 ${meta.ring} ${meta.color}`}
                >
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
