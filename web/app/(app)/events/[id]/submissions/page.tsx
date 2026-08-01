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

  const [{ data: membership }, { data: subsRaw }, { data: myTeamMembership }] = await Promise.all([
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
      .select("id, team_id, submitter_id, status, current_version, updated_at, title, github_url")
      .eq("event_id", id)
      .order("updated_at", { ascending: false }),
    // Resolve current user's team in this event
    user
      ? supabase
          .from("team_members")
          .select("team_id, teams(name)")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Enrich submissions with team names and submitter display names
  type EnrichedSubmission = {
    id: string;
    team_id: string | null;
    submitter_id: string;
    status: string;
    current_version: number;
    updated_at: string;
    title?: string;
    github_url?: string;
    team_name?: string;
    submitter_name?: string;
  };

  let submissions: EnrichedSubmission[] = [];

  if (subsRaw && subsRaw.length > 0) {
    const teamIds = [...new Set(subsRaw.filter((s) => s.team_id).map((s) => s.team_id!))];
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

  const myTeamId =
    (myTeamMembership as { team_id: string; teams: { name: string } | null } | null)?.team_id ??
    null;
  const myTeamName =
    (myTeamMembership as { team_id: string; teams: { name: string } | null } | null)?.teams?.name ??
    null;

  const mySubmission = submissions.find((s) => s.team_id === myTeamId);

  let feedback: Record<string, unknown>[] = [];
  if (event.state === "Completed" && mySubmission) {
    const { data: evals } = await supabase
      .from("evaluations")
      .select("id, total_score, participant_feedback, scores, conflict_of_interest")
      .eq("submission_id", mySubmission.id)
      .eq("status", "Submitted");

    if (evals) {
      feedback = evals.filter((e) => !e.conflict_of_interest);
    }
  }

  return (
    <SubmissionsClient
      eventId={id}
      eventName={event.title}
      eventState={event.state}
      submissionDeadline={
        ((event as Record<string, unknown>).submission_deadline as string) ?? null
      }
      submissions={submissions}
      userRole={membership?.role ?? null}
      userId={user?.id ?? null}
      teamId={myTeamId}
      teamName={myTeamName}
      feedback={feedback}
    />
  );
}
