/**
 * Sponsor Display — shows sponsors with tier badges (M19).
 * Fetches from /api/events/[id]/sponsors and renders a grid.
 */
"use client";

import { useState, useEffect } from "react";

interface Sponsor {
  id: string;
  name: string;
  tier: string;
  contribution_amount: number | null;
  logo_url: string | null;
  website_url: string | null;
}

const TIER_STYLES: Record<string, string> = {
  platinum: "border-[color-mix(in_srgb,#e5e7eb_60%,#a78bfa)] bg-gradient-to-b from-violet-50 to-white dark:from-violet-950/20 dark:to-[var(--card-bg)]",
  gold: "border-amber-200 dark:border-amber-800 bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/20 dark:to-[var(--card-bg)]",
  silver: "border-gray-200 dark:border-gray-700",
  bronze: "border-orange-200 dark:border-orange-800",
};

export function SponsorDisplay({ eventId }: { eventId: string }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/${eventId}/sponsors`);
        if (res.ok) {
          const { data } = await res.json();
          setSponsors(data ?? []);
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventId]);

  if (loading) return null;
  if (sponsors.length === 0) return null;

  // Sort by tier priority
  const tierOrder = ["platinum", "gold", "silver", "bronze"];
  const sorted = [...sponsors].sort(
    (a, b) => tierOrder.indexOf(a.tier.toLowerCase()) - tierOrder.indexOf(b.tier.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--text)]">Sponsors</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((sponsor) => (
          <div
            key={sponsor.id}
            className={`rounded-lg border p-4 ${TIER_STYLES[sponsor.tier.toLowerCase()] ?? "border-[var(--border)]"}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {sponsor.logo_url ? (
                  <img
                    src={sponsor.logo_url}
                    alt={`${sponsor.name} logo`}
                    className="h-8 w-8 rounded object-contain"
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-[var(--bg-muted)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                    {sponsor.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {sponsor.website_url ? (
                      <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)]">
                        {sponsor.name}
                      </a>
                    ) : (
                      sponsor.name
                    )}
                  </p>
                  {sponsor.contribution_amount && (
                    <p className="text-xs text-[var(--text-muted)]">{sponsor.contribution_amount} XLM</p>
                  )}
                </div>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                {sponsor.tier}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
