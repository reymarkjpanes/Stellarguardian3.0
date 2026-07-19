/**
 * Event winners page — announce winners and prize allocation.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

interface Winner {
  id: string;
  recipient_id: string;
  team_id: string | null;
  prize_amount: number;
  placement: number | null;
  recipient_name?: string;
  team_name?: string;
}

export default function EventWinnersPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [eventId]);

  async function loadData() {
    const supabase = createBrowserClient();

    const { data: winnersData } = await supabase
      .from("winners")
      .select("*")
      .eq("event_id", eventId)
      .order("placement", { ascending: true });

    if (winnersData && winnersData.length > 0) {
      const recipientIds = winnersData.map((w) => w.recipient_id);
      const teamIds = winnersData.filter((w) => w.team_id).map((w) => w.team_id!);

      const [{ data: users }, { data: teams }] = await Promise.all([
        supabase.from("users").select("id, display_name").in("id", recipientIds),
        teamIds.length > 0
          ? supabase.from("teams").select("id, name").in("id", teamIds)
          : Promise.resolve({ data: [] }),
      ]);

      const usersMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));
      const teamsMap = new Map((teams ?? []).map((t) => [t.id, t.name]));

      setWinners(winnersData.map((w) => ({
        ...w,
        recipient_name: usersMap.get(w.recipient_id) ?? "Unknown",
        team_name: w.team_id ? teamsMap.get(w.team_id) ?? undefined : undefined,
      })));
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-[var(--bg-muted)] rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">Winners & Prizes</h2>

      {winners.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Winners have not been announced yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {winners.map((w, idx) => (
            <div key={w.id} className="card p-4 flex items-center gap-4">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg font-bold ${
                idx === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                : idx === 1 ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                : idx === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"
              }`}>
                {w.placement ?? idx + 1}
              </div>
              <div className="flex-1">
                <p className="font-medium text-[var(--text)]">
                  {w.team_name ?? w.recipient_name}
                </p>
                {w.team_name && (
                  <p className="text-xs text-[var(--text-muted)]">{w.recipient_name}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-[var(--accent)]">
                  {w.prize_amount} XLM
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
