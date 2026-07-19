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

  // Get membership info
  const { data: members } = await supabase
    .from("event_members")
    .select("user_id, role, status")
    .eq("event_id", id);

  // Get teams
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, captain_id, team_members(user_id, joined_at)")
    .eq("event_id", id);

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
    />
  );
}
