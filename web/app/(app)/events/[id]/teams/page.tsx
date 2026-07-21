/**
 * Event teams page — Server Component.
 * Fetches all data in parallel server-side, passes to client component for interactions.
 */
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/user";
import { getEventById } from "@/lib/data/event";
import { TeamsClient } from "./teams-client";

export default async function EventTeamsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, event] = await Promise.all([getCurrentUser(), getEventById(id)]);
  if (!event) notFound();

  const supabase = await createServerClient();

  const [{ data: teamsRaw }, { data: membership }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, captain_id")
      .eq("event_id", id),
    user
      ? supabase
          .from("event_members")
          .select("role")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Enrich teams with member display names
  type EnrichedTeam = {
    id: string;
    name: string;
    captain_id: string;
    members: { user_id: string; display_name: string }[];
  };

  let teams: EnrichedTeam[] = [];

  if (teamsRaw && teamsRaw.length > 0) {
    const teamIds = teamsRaw.map((t) => t.id);

    const { data: membersData } = await supabase
      .from("team_members")
      .select("team_id, user_id")
      .in("team_id", teamIds);

    const userIds = [...new Set((membersData ?? []).map((m) => m.user_id))];
    const { data: usersData } =
      userIds.length > 0
        ? await supabase.from("users").select("id, display_name").in("id", userIds)
        : { data: [] };

    const usersMap = new Map((usersData ?? []).map((u) => [u.id, u.display_name]));

    teams = teamsRaw.map((t) => ({
      ...t,
      members: (membersData ?? [])
        .filter((m) => m.team_id === t.id)
        .map((m) => ({
          user_id: m.user_id,
          display_name: usersMap.get(m.user_id) ?? "Unknown",
        })),
    }));
  }

  return (
    <TeamsClient
      eventId={id}
      eventState={event.state}
      teams={teams}
      userId={user?.id ?? null}
      userRole={membership?.role ?? null}
    />
  );
}
