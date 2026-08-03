/**
 * Event Sponsors Page — C5 (Phase 3)
 *
 * All members can view the sponsors list.
 * Organizers can add sponsors (name, tier, contribution amount).
 * Sponsors see their own contribution details prominently.
 *
 * Data: GET /api/events/[id]/sponsors
 * Create: POST /api/events/[id]/sponsors (organizer only)
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      const res = await fetch(`/api/events/${eventId}/sponsors`);
      const { data } = await res.json();

      if (!ignore) {
        setSponsors(
          (data ?? []).sort(
            (a: Sponsor, b: Sponsor) => TIER_META[a.tier].order - TIER_META[b.tier].order,
          ),
        );
        setIsOrganizer(membership.role === "Organizer");
        setCurrentUserId(user.id);
        setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [eventId, router]);

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
