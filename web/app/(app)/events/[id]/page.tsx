import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { EventDetailClient } from "./event-detail-client";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) notFound();

  // Parallel fetch of all event data
  const [
    { data: members },
    { data: teams },
    { data: judgeMembers },
    { data: organizerWallet },
  ] = await Promise.all([
    supabase.from("event_members").select("user_id, role, status").eq("event_id", id),
    supabase.from("teams").select("id, name, captain_id, team_members(user_id, joined_at)").eq("event_id", id),
    // Count judges assigned to this event
    supabase.from("event_members").select("user_id").eq("event_id", id).eq("role", "Judge"),
    // Check if organizer has a verified Stellar wallet
    supabase.from("wallets").select("id").eq("user_id", event.organizer_id).eq("verification_status", "Verified").limit(1).maybeSingle(),
  ]);

  const isOrganizer = user?.id === event.organizer_id;
  const myMembership = members?.find((m) => m.user_id === user?.id);

  return (
    <EventDetailClient
      event={event}
      members={members ?? []}
      teams={teams ?? []}
      isOrganizer={isOrganizer}
      myMembership={myMembership ?? null}
      userId={user?.id ?? null}
      judgeCount={judgeMembers?.length ?? 0}
      hasVerifiedOrganizer={!!organizerWallet}
      reviewWindowHours={event.review_window_hours ?? 72}
    />
  );
}
