import { notFound, redirect } from 'next/navigation';
import { createServerClient as createClient } from '@/lib/supabase/server';
import { OrganizerPrizeDashboardClient } from '@/components/events/prizes/OrganizerPrizeDashboardClient';
import { ensureDraftBatch } from '@/app/actions/prize-allocation.actions';

export default async function OrganizerPrizeDashboardPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const eventId = params.id;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  // 1. Verify Organizer Role
  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member || (member.role !== 'Organizer' && member.role !== 'Admin')) {
    redirect(`/events/${eventId}`);
  }

  // 2. Event Must be Finalized
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('status, version')
    .eq('id', eventId)
    .single();

  if (eventError || !event || (event.status !== 'Completed' && event.status !== 'Archived')) {
    // Redirect back to judging if not finalized
    redirect(`/events/${eventId}/judging`);
  }

  // 3. Lazy Initialization of Draft Batch
  const batch = await ensureDraftBatch(eventId);

  // 4. Fetch necessary data for UI
  const [categoriesRes, snapshotsRes, allocationsRes] = await Promise.all([
    supabase.from('prize_categories').select('*').eq('event_id', eventId).order('total_amount', { ascending: false }),
    supabase.from('event_rankings_snapshot').select('*, submissions(title)').eq('event_id', eventId).order('ranking', { ascending: true }),
    supabase.from('prize_allocations').select('*').eq('batch_id', batch.id)
  ]);

  return (
    <OrganizerPrizeDashboardClient 
      eventId={eventId}
      batchId={batch.id}
      batchStatus={batch.status}
      initialCategories={categoriesRes.data || []}
      snapshots={snapshotsRes.data || []}
      initialAllocations={allocationsRes.data || []}
    />
  );
}
