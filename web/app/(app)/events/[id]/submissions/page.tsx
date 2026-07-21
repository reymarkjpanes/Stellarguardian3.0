/**
 * Event submissions page — Server Component.
 * Fetches all data in parallel server-side, passes to client component for submit form interaction.
 */
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/user";
import { getEventById } from "@/lib/data/event";
import { SubmissionsClient } from "./submissions-client";

export default async function EventSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, event] = await Promise.all([getCurrentUser(), getEventById(id)]);
  if (!event) notFound();

  const supabase = await createServerClient();

  const [{ data: membership }, { data: subsRaw }] = await Promise.all([
    user
      ? supabase
          .from("event_members")
          .select("role")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("submissions")
      .select("id, team_id, submitter_id, status, current_version, updated_at")
      .eq("event_id", id)
      .order("updated_at", { ascending: false }),
  ]);

  // Enrich submissions with team names and submitter display names
  type EnrichedSubmission = {
    id: string;
    team_id: string | null;
    submitter_id: string;
    status: string;
    current_version: number;
    updated_at: string;
    team_name?: string;
    submitter_name?: string;
  };

  let submissions: EnrichedSubmission[] = [];

  if (subsRaw && subsRaw.length > 0) {
    const teamIds = [
      ...new Set(subsRaw.filter((s) => s.team_id).map((s) => s.team_id!)),
    ];
    const submitterIds = [...new Set(subsRaw.map((s) => s.submitter_id))];

    const [{ data: teamsData }, { data: usersData }] = await Promise.all([
      teamIds.length > 0
        ? supabase.from("teams").select("id, name").in("id", teamIds)
        : Promise.resolve({ data: [] }),
      supabase.from("users").select("id, display_name").in("id", submitterIds),
    ]);

    const teamsMap = new Map((teamsData ?? []).map((t) => [t.id, t.name]));
    const usersMap = new Map((usersData ?? []).map((u) => [u.id, u.display_name]));

    submissions = subsRaw.map((s) => ({
      ...s,
      team_name: s.team_id ? (teamsMap.get(s.team_id) ?? "Unknown Team") : undefined,
      submitter_name: usersMap.get(s.submitter_id) ?? "Unknown",
    }));
  }

  return (
    <SubmissionsClient
      eventId={id}
      eventState={event.state}
      submissions={submissions}
      userRole={membership?.role ?? null}
    />
  );
}
