'use server';

import { createServerClient as createClient } from '@/lib/supabase/server';
import { FinalizationService } from '@/src/domains/rankings/services/FinalizationService';
import type { LiveRankingData } from '@/components/events/judging/organizer/RankingPreviewTable';
import type { ProgressData } from '@/components/events/judging/organizer/JudgingProgressStats';

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
    supabase
      .from('view_judging_progress')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('view_live_rankings')
      .select('submission_id, title, judge_count, average_score')
      .eq('event_id', eventId)
      .order('average_score', { ascending: false }),
    supabase
      .from('event_rankings_snapshot')
      .select('*, submissions(title)')
      .eq('event_id', eventId)
      .order('ranking', { ascending: true }),
  ]);

  // ── 2. Progress — fallback to base table aggregation ────────────────────
  let progress: ProgressData;

  if (!progressRes.error && progressRes.data) {
    const d = progressRes.data as Record<string, unknown>;
    progress = {
      total_assigned: Number(d.total_assigned ?? 0),
      count_draft:    Number(d.count_draft ?? 0),
      count_completed: Number(d.count_completed ?? 0),
      count_flagged:  Number(d.count_flagged ?? 0),
    };
  } else {
    // View missing — aggregate from evaluations joined to submissions
    const { data: evals } = await supabase
      .from('evaluations')
      .select('id, status, submissions!inner(event_id)')
      .eq('submissions.event_id', eventId);

    const rows = evals ?? [];
    progress = {
      total_assigned:  rows.length,
      count_draft:     rows.filter((e) => e.status === 'Draft').length,
      count_completed: rows.filter((e) => e.status === 'Submitted' || e.status === 'Finalized').length,
      count_flagged:   rows.filter((e) => e.status === 'Flagged').length,
    };
  }

  // ── 3. Live rankings — fallback to base table aggregation ───────────────
  let liveRankings: LiveRankingData[];

  if (!liveRankingsRes.error && liveRankingsRes.data) {
    // View returned data — coerce title to non-null string
    liveRankings = (liveRankingsRes.data as Array<{
      submission_id: string;
      title: string | null;
      judge_count: number;
      average_score: number | null;
    }>).map((r) => ({
      submission_id: r.submission_id,
      title: r.title ?? 'Untitled',
      judge_count: Number(r.judge_count),
      average_score: r.average_score !== null ? Number(r.average_score) : null,
    }));
  } else {
    // View missing — compute from submissions + evaluations
    const { data: subs } = await supabase
      .from('submissions')
      .select('id, teams(name), evaluations(total_score, status)')
      .eq('event_id', eventId);

    liveRankings = (subs ?? []).map((s) => {
      // Supabase returns joined rows as an array — normalise
      const teamRow = Array.isArray(s.teams) ? s.teams[0] : s.teams;
      const title: string = (teamRow as { name?: string } | null)?.name ?? 'Untitled';

      const scores = (
        (s.evaluations as Array<{ total_score: number | null; status: string }>) ?? []
      )
        .filter((e) => e.status === 'Submitted' || e.status === 'Finalized')
        .map((e) => e.total_score ?? 0);

      return {
        submission_id: s.id,
        title,
        judge_count: scores.length,
        average_score:
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : null,
      } satisfies LiveRankingData;
    }).sort((a, b) => (b.average_score ?? -1) - (a.average_score ?? -1));
  }

  // ── 4. Snapshots — table (not a view), no fallback needed ────────────────
  if (snapshotsRes.error) {
    console.warn(
      '[fetchJudgingAnalytics] event_rankings_snapshot not available:',
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
  if (!user) throw new Error('Unauthorized');

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member || (member.role !== 'Organizer' && member.role !== 'Admin')) {
    throw new Error('Forbidden: Only Organizers can finalize judging');
  }

  const rankings = await FinalizationService.finalizeEvent(eventId, expectedVersion);
  return rankings;
}
