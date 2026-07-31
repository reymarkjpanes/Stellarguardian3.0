"use client";

import { EventStateBadge } from "@/components/ui/event-state-badge";
import Link from "next/link";

interface SponsoredEvent {
  id: string;
  title: string;
  state: string;
  prizePoolTarget: number | null;
  escrowState: string | null;
  expectedBalance: string | null;
}

interface Props {
  events: SponsoredEvent[];
}

export function SponsorEventList({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const target = event.prizePoolTarget || 0;
        const balance = Number(event.expectedBalance || 0);
        const percentFunded = target > 0 ? Math.min(100, Math.round((balance / target) * 100)) : 0;

        let automationStatus = "Pending Setup";
        if (event.state === "PrizeApproved") {
          automationStatus = "Awaiting Automated Payout (Watching for 0 Disputes)";
        } else if (event.state === "EscrowRelease") {
          automationStatus = "Payout Executing (On-chain)";
        } else if (event.state === "Completed") {
          automationStatus = "Payout Complete";
        } else if (event.escrowState === "FullyFunded") {
          automationStatus = "Awaiting Judging/Winners";
        } else if (
          event.escrowState === "PartiallyFunded" ||
          event.escrowState === "PendingFunding"
        ) {
          automationStatus = "Awaiting Funding";
        }

        return (
          <div key={event.id} className="card p-5 space-y-4 border-l-4 border-l-[var(--accent)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--text)]">{event.title}</h3>
                <div className="mt-1 flex flex-wrap gap-2 items-center">
                  <EventStateBadge state={event.state} />
                  <span className="text-xs text-[var(--text-muted)]">
                    Escrow:{" "}
                    <span className="font-medium">{event.escrowState || "Not initialized"}</span>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-muted)]">Prize Pool</p>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {target.toLocaleString()} XLM
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-[var(--border)]">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Funding Progress</p>
                <p className="text-sm font-medium mt-0.5">{percentFunded}%</p>
                <div className="mt-1.5 h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all"
                    style={{ width: `${percentFunded}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Escrow Balance</p>
                <p className="text-sm font-medium mt-0.5">{balance.toLocaleString()} XLM</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-[var(--text-muted)]">Automation Status</p>
                <p className="text-sm font-medium mt-0.5 flex items-center gap-2">
                  {event.state === "PrizeApproved" || event.state === "EscrowRelease" ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
                    </span>
                  ) : null}
                  {automationStatus}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/events/${event.id}`}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                View Event →
              </Link>
              <Link
                href={`/events/${event.id}/escrow`}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                View Escrow & Payouts →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
