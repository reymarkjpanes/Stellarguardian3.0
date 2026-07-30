"use server";

import { createServerClient as createClient } from "@/lib/supabase/server";
import { FinalizationService } from "@/src/domains/rankings/services/FinalizationService";
import type { LiveRankingData } from "@/components/events/judging/organizer/RankingPreviewTable";
import type { ProgressData } from "@/components/events/judging/organizer/JudgingProgressStats";

/**
 * Fetch judging analytics for an event.
 *
 * Primary path: queries `view_judging_progress` and `view_live_rankings`.
 * Fallback path: computes equivalent data from base tables when the views
 * are not yet deployed (schema cache miss — run migration
 * 20250722000002_judging_views_and_rpc_fix.sql to create them permanently).
 */
export async function fetchJudgingAnalytics(eventId: string) {
  const supabase = await createClient();

  // ── 1. Parallel fetch ────────────────────────────────────────────────────
  const [progressRes, liveRankingsRes, snapshotsRes] = await Promise.all([
    supabase.from("view_judging_progress").select("*").eq("event_id", eventId).maybeSingle(),
    supabase
      .from("view_live_rankings")
      .select("submission_id, title, judge_count, average_score")
      .eq("event_id", eventId)
      .order("average_score", { ascending: false }),
    supabase
      .from("event_rankings_snapshot")
      .select("*, submissions(title)")
      .eq("event_id", eventId)
      .order("ranking", { ascending: true }),
  ]);

  // ── 2. Progress — fallback to base table aggregation ────────────────────
  let progress: ProgressData;

  if (!progressRes.error && progressRes.data) {
    const d = progressRes.data as Record<string, unknown>;
    progress = {
      total_assigned: Number(d.total_assigned ?? 0),
      count_draft: Number(d.count_draft ?? 0),
      count_completed: Number(d.count_completed ?? 0),
      count_flagged: Number(d.count_flagged ?? 0),
    };
  } else {
    // View missing — aggregate from evaluations joined to submissions
    // NOTE: 'status' is part of a pending migration, so we omit it to avoid 500 errors.
    const { data: evals } = await supabase
      .from("evaluations")
      .select("id, submissions!inner(event_id)")
      .eq("submissions.event_id", eventId);

    const rows = evals ?? [];
    progress = {
      total_assigned: rows.length,
      count_draft: rows.length, // Fallback to all drafts
      count_completed: 0,
      count_flagged: 0,
    };
  }

  // ── 3. Live rankings — fallback to base table aggregation ───────────────
  let liveRankings: LiveRankingData[];

  if (!liveRankingsRes.error && liveRankingsRes.data) {
    // View returned data — coerce title to non-null string
    liveRankings = (
      liveRankingsRes.data as Array<{
        submission_id: string;
        title: string | null;
        judge_count: number;
        average_score: number | null;
      }>
    ).map((r) => ({
      submission_id: r.submission_id,
      title: r.title ?? "Untitled",
      judge_count: Number(r.judge_count),
      average_score: r.average_score !== null ? Number(r.average_score) : null,
    }));
  } else {
    // View missing — compute from submissions + evaluations
    // NOTE: 'status' and 'total_score' are part of a pending migration, so we omit them.
    const { data: subs } = await supabase
      .from("submissions")
      .select("id, teams(name), evaluations(id)")
      .eq("event_id", eventId);

    liveRankings = (subs ?? [])
      .map((s) => {
        // Supabase returns joined rows as an array — normalise
        const teamRow = Array.isArray(s.teams) ? s.teams[0] : s.teams;
        const title: string = (teamRow as { name?: string } | null)?.name ?? "Untitled";

        const judgeCount = (s.evaluations ?? []).length;
        const averageScore = null; // Default since total_score is missing

        return {
          submission_id: s.id,
          title,
          judge_count: judgeCount,
          average_score: averageScore,
        } satisfies LiveRankingData;
      })
      .sort((a, b) => (b.average_score ?? -1) - (a.average_score ?? -1));
  }

  // ── 4. Snapshots — table (not a view), no fallback needed ────────────────
  if (snapshotsRes.error) {
    console.warn(
      "[fetchJudgingAnalytics] event_rankings_snapshot not available:",
      snapshotsRes.error.message,
    );
  }

  return {
    progress,
    liveRankings,
    snapshots: snapshotsRes.data ?? [],
    refreshedAt: new Date().toISOString(),
  };
}

export async function finalizeEventAction(eventId: string, expectedVersion: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: member } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member || (member.role !== "Organizer" && member.role !== "Admin")) {
    throw new Error("Forbidden: Only Organizers can finalize judging");
  }

  const rankings = await FinalizationService.finalizeEvent(eventId, expectedVersion);
  return rankings;
}

export type JudgeAssignmentData = {
  evaluation_id: string;
  judge_id: string;
  judge_name: string;
  submission_id: string;
  submission_title: string;
  status: string;
  total_score: number | null;
  conflict_of_interest: boolean;
};

export async function fetchJudgeAssignments(eventId: string): Promise<JudgeAssignmentData[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evaluations")
    .select(
      "id, judge_id, submission_id, status, total_score, conflict_of_interest, users(display_name, email), submissions!inner(event_id, teams(name))",
    )
    .eq("submissions.event_id", eventId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Failed to fetch judge assignments:", error);
    return [];
  }

  return data.map(
    (row: {
      id: string;
      judge_id: string;
      submission_id: string;
      status: string;
      total_score: number | null;
      conflict_of_interest: boolean;
      users: unknown;
      submissions: unknown;
    }) => {
      const user = row.users as { display_name?: string; email?: string } | null;
      const sub = row.submissions as unknown as { teams?: { name?: string } | null } | null;

      // Supabase arrays from joins
      const teamRow = Array.isArray(sub?.teams) ? sub.teams[0] : sub?.teams;

      return {
        evaluation_id: row.id,
        judge_id: row.judge_id,
        judge_name: user?.display_name || user?.email || "Unknown Judge",
        submission_id: row.submission_id,
        submission_title: teamRow?.name || "Untitled Submission",
        status: row.status || "Draft",
        total_score: row.total_score !== null ? Number(row.total_score) : null,
        conflict_of_interest: row.conflict_of_interest || false,
      };
    },
  );
}

export type SubmissionEvaluationDetail = {
  id: string;
  judge_id: string;
  judge_name: string;
  status: string;
  total_score: number | null;
  conflict_of_interest: boolean;
  scores: Record<string, number> | null;
  feedback: string | null;
};

export async function fetchSubmissionEvaluationsDetails(
  submissionId: string,
): Promise<SubmissionEvaluationDetail[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evaluations")
    .select(
      "id, judge_id, status, total_score, conflict_of_interest, scores_json, participant_feedback, organizer_notes, users(display_name, email)",
    )
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("Failed to fetch submission evaluations:", error);
    return [];
  }

  return data.map(
    (row: {
      id: string;
      judge_id: string;
      status: string;
      total_score: number | null;
      conflict_of_interest: boolean;
      scores_json: unknown;
      participant_feedback: string | null;
      organizer_notes: string | null;
      users: unknown;
    }) => {
      const user = row.users as { display_name?: string; email?: string } | null;

      let scores = null;
      if (row.scores_json) {
        try {
          scores =
            typeof row.scores_json === "string" ? JSON.parse(row.scores_json) : row.scores_json;
        } catch (e) {
          console.error("Failed to parse scores JSON:", e);
        }
      }

      return {
        id: row.id,
        judge_id: row.judge_id,
        judge_name: user?.display_name || user?.email || "Unknown Judge",
        status: row.status || "Draft",
        total_score: row.total_score !== null ? Number(row.total_score) : null,
        conflict_of_interest: row.conflict_of_interest || false,
        scores,
        feedback: row.organizer_notes || row.participant_feedback || null,
      };
    },
  );
}
