/**
 * Event winners page — Server Component.
 * Fetches all data in parallel server-side, passes to client component for winner assignment form.
 */
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/user";
import { getEventById } from "@/lib/data/event";
import { WinnersClient } from "./winners-client";

export default async function EventWinnersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [user, event] = await Promise.all([getCurrentUser(), getEventById(id)]);
  if (!event) notFound();

  const supabase = await createServerClient();

  const [{ data: membership }, { data: winnersRaw }] = await Promise.all([
    user
      ? supabase
          .from("event_members")
          .select("role")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("winners")
      .select("id, recipient_id, team_id, prize_amount, disbursement_status")
      .eq("event_id", id)
      .order("prize_amount", { ascending: false }),
  ]);

  const isOrganizer = membership?.role === "Organizer";

  // Enrich winners with display names and verified wallet addresses (M13)
  type EnrichedWinner = {
    id: string;
    recipient_id: string;
    team_id: string | null;
    prize_amount: number;
    disbursement_status: string;
    recipient_name: string;
    team_name: string | null;
    wallet_address: string | null;
  };

  let winners: EnrichedWinner[] = [];

  if (winnersRaw && winnersRaw.length > 0) {
    const recipientIds = winnersRaw.map((w) => w.recipient_id);
    const teamIds = winnersRaw.filter((w) => w.team_id).map((w) => w.team_id!);

    const [{ data: usersData }, { data: teamsData }, { data: walletsData }] = await Promise.all([
      supabase.from("users").select("id, display_name").in("id", recipientIds),
      teamIds.length > 0
        ? supabase.from("teams").select("id, name").in("id", teamIds)
        : Promise.resolve({ data: [] }),
      // Fetch verified wallets so participants can see which address is registered
      supabase
        .from("wallets")
        .select("user_id, public_key")
        .in("user_id", recipientIds)
        .eq("verification_status", "Verified"),
    ]);

    const usersMap = new Map((usersData ?? []).map((u) => [u.id, u.display_name]));
    const teamsMap = new Map((teamsData ?? []).map((t) => [t.id, t.name]));
    // Use the first verified wallet per user
    const walletsMap = new Map<string, string>();
    for (const w of walletsData ?? []) {
      if (!walletsMap.has(w.user_id)) walletsMap.set(w.user_id, w.public_key);
    }

    winners = winnersRaw.map((w) => ({
      ...w,
      recipient_name: usersMap.get(w.recipient_id) ?? "Unknown",
      team_name: w.team_id ? (teamsMap.get(w.team_id) ?? null) : null,
      wallet_address: walletsMap.get(w.recipient_id) ?? null,
    }));
  }

  // Fetch submissions for organizer winner-assignment form
  type SubmissionForSelect = {
    id: string;
    submitter_id: string;
    team_id: string | null;
    submitter_name: string;
    team_name: string | null;
  };

  let submissions: SubmissionForSelect[] = [];

  if (isOrganizer) {
    const { data: subsRaw } = await supabase
      .from("submissions")
      .select("id, submitter_id, team_id")
      .eq("event_id", id)
      .eq("status", "Submitted");

    if (subsRaw && subsRaw.length > 0) {
      const submitterIds = [...new Set(subsRaw.map((s) => s.submitter_id))];
      const subTeamIds = [...new Set(subsRaw.filter((s) => s.team_id).map((s) => s.team_id!))];

      const [{ data: subUsers }, { data: subTeams }] = await Promise.all([
        supabase.from("users").select("id, display_name").in("id", submitterIds),
        subTeamIds.length > 0
          ? supabase.from("teams").select("id, name").in("id", subTeamIds)
          : Promise.resolve({ data: [] }),
      ]);

      const usersMap2 = new Map((subUsers ?? []).map((u) => [u.id, u.display_name]));
      const teamsMap2 = new Map((subTeams ?? []).map((t) => [t.id, t.name]));

      submissions = subsRaw.map((s) => ({
        ...s,
        submitter_name: usersMap2.get(s.submitter_id) ?? "Unknown",
        team_name: s.team_id ? (teamsMap2.get(s.team_id) ?? null) : null,
      }));
    }
  }

  return (
    <WinnersClient
      eventId={id}
      eventState={event.state}
      winners={winners}
      submissions={submissions}
      isOrganizer={isOrganizer}
      userId={user?.id ?? null}
    />
  );
}
