'use server';

import { createServerClient as createClient } from '@/lib/supabase/server';
import { FinalizationService } from '@/src/domains/rankings/services/FinalizationService';

export async function fetchJudgingAnalytics(eventId: string) {
  const supabase = await createClient();

  // Parallel fetch from all views
  const [progressRes, liveRankingsRes, snapshotsRes] = await Promise.all([
    supabase.from('view_judging_progress').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('view_live_rankings').select('*').eq('event_id', eventId).order('average_score', { ascending: false }),
    supabase.from('event_rankings_snapshot').select('*, submissions(title)').eq('event_id', eventId).order('ranking', { ascending: true })
  ]);

  if (progressRes.error) throw new Error(`Progress error: ${progressRes.error.message}`);
  if (liveRankingsRes.error) throw new Error(`Rankings error: ${liveRankingsRes.error.message}`);
  if (snapshotsRes.error) throw new Error(`Snapshots error: ${snapshotsRes.error.message}`);

  return {
    progress: progressRes.data || { total_assigned: 0, count_draft: 0, count_completed: 0, count_flagged: 0 },
    liveRankings: liveRankingsRes.data || [],
    snapshots: snapshotsRes.data || [],
    refreshedAt: new Date().toISOString()
  };
}

export async function finalizeEventAction(eventId: string, expectedVersion: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify caller is an organizer
  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member || (member.role !== 'Organizer' && member.role !== 'Admin')) {
    throw new Error('Forbidden: Only Organizers can finalize judging');
  }

  // Execute Finalization Service
  const rankings = await FinalizationService.finalizeEvent(eventId, expectedVersion);
  return rankings;
}
