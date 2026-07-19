/**
 * EventTrustSignals — Data-driven trust verification panel.
 *
 * Key improvement over the old TrustChecklist:
 * - Old: self-reported booleans (organizer just ticks boxes)
 * - New: derived from actual verified database state:
 *   • Escrow funded → real on-chain balance via verify-escrow API
 *   • Organizer verified → wallet.verification_status === 'Verified' in DB
 *   • Judges assigned → count from event_members WHERE role='Judge'
 *   • Rules published → event left Draft state (state machine enforced)
 *   • Review window → review_window_hours stored and enforced by cron
 *
 * This is meaningful for participants deciding whether to trust an event.
 *
 * Design: monochrome base, semantic color for status only.
 * Signals are ordered by impact on participant confidence.
 */
"use client";

import { useEffect, useState } from "react";

interface TrustSignal {
  id: string;
  label: string;
  description: string;
  status: "verified" | "pending" | "warning" | "na";
  detail?: string;
}

interface EventTrustSignalsProps {
  eventId: string;
  eventState: string;
  prizePoolTarget: number | null;
  judgeCount: number;
  hasVerifiedOrganizer: boolean;
  reviewWindowHours: number;
  networkMode: "testnet" | "mainnet";
}

export function EventTrustSignals({
  eventId,
  eventState,
  prizePoolTarget,
  judgeCount,
  hasVerifiedOrganizer,
  reviewWindowHours,
  networkMode,
}: EventTrustSignalsProps) {
  const [escrowBalance, setEscrowBalance] = useState<number | null>(null);
  const [escrowLoading, setEscrowLoading] = useState(false);

  // Only fetch escrow balance if event is past Draft/Published
  const escrowRelevant = ![
    "Draft", "Published", "RegistrationOpen", "RegistrationClosed", "TeamFormation"
  ].includes(eventState);

  useEffect(() => {
    if (!escrowRelevant) return;
    setEscrowLoading(true);
    fetch(`/api/events/${eventId}/verify-escrow`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.data?.balance !== undefined) {
          setEscrowBalance(Number(data.data.balance));
        }
      })
      .catch(() => null)
      .finally(() => setEscrowLoading(false));
  }, [eventId, escrowRelevant]);

  const escrowFunded = escrowBalance !== null && prizePoolTarget !== null && escrowBalance >= prizePoolTarget;

  const signals: TrustSignal[] = [
    {
      id: "escrow",
      label: "Prize pool secured",
      description: "Funds locked in on-chain escrow",
      status: !escrowRelevant
        ? "pending"
        : escrowLoading
        ? "pending"
        : escrowFunded
        ? "verified"
        : "warning",
      detail: !escrowRelevant
        ? "Funding begins after team formation"
        : escrowLoading
        ? "Checking on-chain balance…"
        : escrowFunded
        ? `${escrowBalance} XLM confirmed on ${networkMode}`
        : `${escrowBalance ?? 0} / ${prizePoolTarget ?? 0} XLM on ${networkMode}`,
    },
    {
      id: "organizer",
      label: "Organizer verified",
      description: "Wallet ownership cryptographically confirmed",
      status: hasVerifiedOrganizer ? "verified" : "warning",
      detail: hasVerifiedOrganizer
        ? "Stellar wallet verified via challenge-response"
        : "Organizer has not yet verified their wallet",
    },
    {
      id: "judges",
      label: "Judges assigned",
      description: "Independent judges confirmed for fair scoring",
      status: judgeCount >= 1 ? "verified" : eventState === "Draft" ? "na" : "pending",
      detail: judgeCount >= 1
        ? `${judgeCount} judge${judgeCount > 1 ? "s" : ""} assigned`
        : "No judges assigned yet",
    },
    {
      id: "lifecycle",
      label: "Rules & timeline set",
      description: "Event configuration locked before registration",
      status: !["Draft"].includes(eventState) ? "verified" : "pending",
      detail: !["Draft"].includes(eventState)
        ? "Configuration confirmed at publish"
        : "Event is still in draft",
    },
    {
      id: "review",
      label: "Dispute window",
      description: "Objection period before irreversible disbursement",
      status: reviewWindowHours >= 24 ? "verified" : "warning",
      detail: reviewWindowHours >= 24
        ? `${reviewWindowHours}h review window configured`
        : "Review window should be at least 24 hours",
    },
  ];

  const verifiedCount = signals.filter((s) => s.status === "verified").length;
  const totalRelevant = signals.filter((s) => s.status !== "na").length;

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-elevated)]">
        <div>
          <p className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider">Trust Signals</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Verified from on-chain and database state</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className={`text-sm font-bold ${
              verifiedCount === totalRelevant ? "text-[var(--success)]" : "text-[var(--text)]"
            }`}>
              {verifiedCount}/{totalRelevant}
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">verified</p>
          </div>
          {/* Mini progress arc */}
          <div className="h-8 w-8 relative">
            <svg viewBox="0 0 32 32" className="rotate-[-90deg]">
              <circle cx="16" cy="16" r="12" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle
                cx="16" cy="16" r="12" fill="none"
                stroke={verifiedCount === totalRelevant ? "var(--success)" : "var(--accent)"}
                strokeWidth="3"
                strokeDasharray={`${(verifiedCount / Math.max(totalRelevant, 1)) * 75.4} 75.4`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Signal list */}
      <div className="divide-y divide-[var(--border)]">
        {signals.map((signal) => (
          <div key={signal.id} className="px-4 py-2.5 flex items-start gap-3">
            {/* Status indicator */}
            <div className={`mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
              signal.status === "verified"
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : signal.status === "warning"
                ? "bg-[var(--warning-bg)] text-[var(--warning)]"
                : signal.status === "na"
                ? "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
            }`}>
              {signal.status === "verified" ? "✓"
                : signal.status === "warning" ? "!"
                : signal.status === "pending" ? "·"
                : "–"}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-xs font-medium leading-tight ${
                  signal.status === "verified" ? "text-[var(--text)]"
                  : signal.status === "na" ? "text-[var(--text-muted)]"
                  : "text-[var(--text-secondary)]"
                }`}>
                  {signal.label}
                </p>
                <span className={`text-[10px] font-medium flex-shrink-0 ${
                  signal.status === "verified" ? "text-[var(--success)]"
                  : signal.status === "warning" ? "text-[var(--warning)]"
                  : "text-[var(--text-muted)]"
                }`}>
                  {signal.status === "verified" ? "Verified"
                    : signal.status === "warning" ? "Attention"
                    : signal.status === "na" ? "N/A"
                    : "Pending"}
                </span>
              </div>
              {signal.detail && (
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-tight">{signal.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
