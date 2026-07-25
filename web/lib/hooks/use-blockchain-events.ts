"use client";

/**
 * useBlockchainEvents — real-time blockchain event synchronization.
 *
 * Polls the contract events API on an interval and fires callbacks when
 * new events arrive. Integrates with Supabase Realtime for DB-level escrow
 * state changes so the UI reflects both on-chain and off-chain updates
 * without requiring a page refresh.
 *
 * Architecture:
 *   Contract event emitted
 *     → GET /api/events/[id]/contract-events (polled every 15s)
 *     → useBlockchainEvents deduplicates → fires onEvent()
 *
 *   Backend writes DB record after confirming tx
 *     → Supabase Realtime pushes escrow_accounts / transactions row change
 *     → escrowState updated instantly (no polling lag)
 *
 * Usage:
 *   const { events, status, escrowState } = useBlockchainEvents({
 *     eventId,
 *     onEvent: (e) => { if (e.type === "deposit") refetch(); },
 *   });
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export interface BlockchainEvent {
  id: string;
  /** Contract event name: deposit | sponsor | locked | batch | disburse | finalize | refund */
  type: string;
  ledger: number;
  createdAt: string;
  topics: string[];
  value: unknown;
}

export type BlockchainSyncStatus = "idle" | "syncing" | "live" | "error";

export interface UseBlockchainEventsOptions {
  eventId: string;
  onEvent?: (event: BlockchainEvent) => void;
  /** Poll interval in ms — default 15 000 (15s) */
  pollInterval?: number;
  enabled?: boolean;
}

export interface UseBlockchainEventsReturn {
  events: BlockchainEvent[];
  status: BlockchainSyncStatus;
  refetch: () => void;
  escrowState: {
    state: string | null;
    onChainBalance: string | null;
    inconsistent: boolean;
  };
}

export function useBlockchainEvents({
  eventId,
  onEvent,
  pollInterval = 15_000,
  enabled = true,
}: UseBlockchainEventsOptions): UseBlockchainEventsReturn {
  const [events, setEvents] = useState<BlockchainEvent[]>([]);
  const [status, setStatus] = useState<BlockchainSyncStatus>("idle");
  const [escrowState, setEscrowState] = useState<{
    state: string | null;
    onChainBalance: string | null;
    inconsistent: boolean;
  }>({ state: null, onChainBalance: null, inconsistent: false });

  const seenIds = useRef<Set<string>>(new Set());
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Store callback in ref so polling closure always has the latest version
  const onEventRef = useRef(onEvent);

  // ── Keep onEvent ref current ───────────────────────────────────────────────
  // useLayoutEffect-style: runs before paint but after all mutations.
  // Using a plain effect with no deps list means it runs every render,
  // updating the ref without triggering re-renders.
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  // ── Core fetch logic ───────────────────────────────────────────────────────
  // Pure async function — not a hook. Called from interval + manual refetch.
  // All setState calls happen inside this async function's callbacks,
  // which are not synchronous effect-body calls.
  const fetchEvents = useCallback(async () => {
    if (!eventId) return;
    setStatus("syncing");
    try {
      const res = await fetch(`/api/events/${eventId}/contract-events`);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data: { events: BlockchainEvent[] } = await res.json();
      const newEvents = (data.events ?? []).filter((e) => !seenIds.current.has(e.id));

      if (newEvents.length > 0) {
        for (const e of newEvents) {
          seenIds.current.add(e.id);
          onEventRef.current?.(e);
        }
        setEvents((prev) => [...newEvents, ...prev].slice(0, 100));
      }
      setStatus("live");
    } catch {
      setStatus("error");
    }
  }, [eventId]);

  // ── Start/stop polling ─────────────────────────────────────────────────────
  // Effect body only starts the interval — no setState inside the body itself.
  // The initial fetch is scheduled via Promise.resolve().then() so it runs
  // as a microtask after the effect body returns.
  useEffect(() => {
    if (!enabled || !eventId) return;

    // Defer the initial fetch out of the effect body
    Promise.resolve().then(() => fetchEvents());

    pollerRef.current = setInterval(() => {
      fetchEvents();
    }, pollInterval);

    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  // fetchEvents is stable (useCallback with [eventId])
  }, [enabled, eventId, pollInterval, fetchEvents]);

  // ── Supabase Realtime — escrow_accounts ────────────────────────────────────
  useEffect(() => {
    if (!enabled || !eventId) return;

    const supabase = createBrowserClient();

    const escrowChannel = supabase
      .channel(`escrow:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "escrow_accounts",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setEscrowState({
            state: (row.state as string) ?? null,
            onChainBalance: (row.last_reconciled_balance as string) ?? null,
            inconsistent: Boolean(row.inconsistent),
          });
        },
      )
      .subscribe();

    // ── Supabase Realtime — transactions ───────────────────────────────────
    const txChannel = supabase
      .channel(`transactions:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const syntheticEvent: BlockchainEvent = {
            id: `db:${row.id as string}`,
            type: (row.type as string) ?? "unknown",
            ledger: 0,
            createdAt: (row.created_at as string) ?? new Date().toISOString(),
            topics: [(row.type as string) ?? ""],
            value: { txHash: row.tx_hash, amount: row.amount },
          };
          if (!seenIds.current.has(syntheticEvent.id)) {
            seenIds.current.add(syntheticEvent.id);
            onEventRef.current?.(syntheticEvent);
            setEvents((prev) => [syntheticEvent, ...prev].slice(0, 100));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(escrowChannel);
      supabase.removeChannel(txChannel);
    };
  }, [enabled, eventId]);

  // ── Manual refetch — called from event handlers, not effects ───────────────
  const refetch = useCallback(() => {
    // fetchEvents is async; calling it from a click handler is fine
    fetchEvents();
  }, [fetchEvents]);

  return { events, status, refetch, escrowState };
}
