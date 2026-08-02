import { notFound, redirect } from "next/navigation";
import { createServerClient as createClient } from "@/lib/supabase/server";
import { OrganizerJudgingDashboardClient } from "@/components/events/judging/organizer/OrganizerJudgingDashboardClient";
import {
  fetchJudgingAnalytics,
  fetchJudgeAssignments,
} from "@/app/actions/judging-analytics.actions";
import { fetchRubricsAction } from "@/app/actions/judging-rubric.actions";
import { JudgeEvaluationsClient } from "@/components/events/judging/JudgeEvaluationsClient";

export default async function JudgingPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const eventId = params.id;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Resolve the user's role in this event
  const { data: member } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = member?.role ?? null;

  // ── Organizer / Admin → full judging dashboard ────────────────────────────
  if (role === "Organizer" || role === "Admin") {
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("state, version")
      .eq("id", eventId)
      .single();

    if (eventError || !event) return notFound();

    const analyticsData = await fetchJudgingAnalytics(eventId);
    const assignments = await fetchJudgeAssignments(eventId);

    return (
      <OrganizerJudgingDashboardClient
        eventId={eventId}
        expectedVersion={event.version}
        isCompleted={event.state === "Completed" || event.state === "Archived"}
        initialData={{ ...analyticsData, assignments }}
      />
    );
  }

  // ── Judge → assigned submissions view ─────────────────────────────────────
  if (role === "Judge") {
    const [{ data: event }, { data: evaluations }, criteria] = await Promise.all([
      supabase.from("events").select("state, title").eq("id", eventId).single(),
      supabase
        .from("evaluations")
        .select(
          "id, submission_id, status, total_score, conflict_of_interest, version, created_at, submissions!inner(id, team_id, submitter_id, event_id, teams(name), users(display_name))",
        )
        .eq("judge_id", user.id)
        .eq("submissions.event_id", eventId)
        .order("created_at", { ascending: false }),
      fetchRubricsAction(eventId),
    ]);

    const judging = (evaluations ?? []).map((e) => {
      const sub = e.submissions as unknown as {
        team_id: string | null;
        teams: { name: string } | null;
        users: { display_name: string } | null;
      } | null;
      return {
        evaluationId: e.id,
        submissionId: e.submission_id,
        // C4: use actual DB status instead of hardcoded "Draft"
        status: e.status ?? "Draft",
        score: e.total_score ?? null,
        conflictOfInterest: e.conflict_of_interest,
        version: e.version ?? 1,
        updatedAt: e.created_at,
        teamName: sub?.teams?.name ?? null,
        submitterName: sub?.users?.display_name ?? null,
      };
    });

    return (
      <JudgeEvaluationsClient
        eventId={eventId}
        eventState={event?.state ?? ""}
        assignments={judging}
        criteria={criteria}
      />
    );
  }

  // ── Everyone else → redirect to event overview ────────────────────────────
  redirect(`/events/${eventId}`);
}
