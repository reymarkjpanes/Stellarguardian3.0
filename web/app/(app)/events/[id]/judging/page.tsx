import { notFound, redirect } from "next/navigation";
import { createServerClient as createClient } from "@/lib/supabase/server";
import { OrganizerJudgingDashboardClient } from "@/components/events/judging/organizer/OrganizerJudgingDashboardClient";
import { fetchJudgingAnalytics } from "@/app/actions/judging-analytics.actions";

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

    return (
      <OrganizerJudgingDashboardClient
        eventId={eventId}
        expectedVersion={event.version}
        isCompleted={event.state === "Completed" || event.state === "Archived"}
        initialData={analyticsData}
      />
    );
  }

  // ── Judge → assigned submissions view ─────────────────────────────────────
  if (role === "Judge") {
    const { data: event } = await supabase
      .from("events")
      .select("state, title")
      .eq("id", eventId)
      .single();

    const { data: evaluations } = await supabase
      .from("evaluations")
      .select(
        "id, submission_id, status, total_score, conflict_of_interest, updated_at, submissions(id, team_id, submitter_id, teams(name), users(display_name))",
      )
      .eq("judge_id", user.id)
      .eq("event_id", eventId)
      .order("updated_at", { ascending: false });

    const judging = (evaluations ?? []).map((e) => {
      const sub = e.submissions as unknown as {
        team_id: string | null;
        teams: { name: string } | null;
        users: { display_name: string } | null;
      } | null;
      return {
        evaluationId: e.id,
        submissionId: e.submission_id,
        status: e.status,
        score: e.total_score,
        conflictOfInterest: e.conflict_of_interest,
        updatedAt: e.updated_at,
        teamName: sub?.teams?.name ?? null,
        submitterName: sub?.users?.display_name ?? null,
      };
    });

    return (
      <JudgeEvaluationsView
        eventId={eventId}
        eventState={event?.state ?? ""}
        assignments={judging}
      />
    );
  }

  // ── Everyone else → redirect to event overview ────────────────────────────
  redirect(`/events/${eventId}`);
}

// ─── Judge view — server component, no client needed ─────────────────────────

interface EvalRow {
  evaluationId: string;
  submissionId: string;
  status: string;
  score: number | null;
  conflictOfInterest: boolean;
  updatedAt: string;
  teamName: string | null;
  submitterName: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "submitted"
      ? "bg-[var(--success-bg)] text-[var(--success)]"
      : s === "draft"
        ? "bg-[var(--warning-bg)] text-[var(--warning)]"
        : "bg-[var(--badge-bg)] text-[var(--badge-text)]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{status}</span>
  );
}

function JudgeEvaluationsView({
  eventId,
  eventState,
  assignments,
}: {
  eventId: string;
  eventState: string;
  assignments: EvalRow[];
}) {
  const judging = eventState === "JudgingRound1" || eventState === "JudgingRound2";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">My Evaluations</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {judging
            ? "Score each assigned submission below. Submit your final score when ready."
            : `Judging is not currently active (${eventState}).`}
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No submissions have been assigned to you yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((ev) => (
            <div key={ev.evaluationId} className="card p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text)] truncate">
                  {ev.teamName ?? ev.submitterName ?? "Unknown"}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {ev.score != null ? `Score: ${ev.score}` : "Not scored"}
                  {ev.conflictOfInterest && (
                    <span className="ml-2 text-[var(--warning)]">⚠ Conflict declared</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={ev.status} />
                <a
                  href={`/events/${eventId}/judging/${ev.evaluationId}`}
                  className="rounded-md border border-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-muted)] transition-colors"
                >
                  {ev.status === "Submitted" ? "View" : "Score"}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
