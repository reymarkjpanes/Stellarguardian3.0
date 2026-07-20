import { notFound, redirect } from 'next/navigation';
import { createServerClient as createClient } from '@/lib/supabase/server';
import { OrganizerJudgingDashboardClient } from '@/components/events/judging/organizer/OrganizerJudgingDashboardClient';
import { fetchJudgingAnalytics } from '@/app/actions/judging-analytics.actions';

export default async function OrganizerJudgingDashboardPage(props: {
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

  // 2. Fetch Event Status & Version for optimistic concurrency
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('status, version')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    return notFound();
  }

  // 3. Fetch Initial Analytics
  const analyticsData = await fetchJudgingAnalytics(eventId);

  return (
    <OrganizerJudgingDashboardClient 
      eventId={eventId}
      expectedVersion={event.version}
      isCompleted={event.status === 'Completed' || event.status === 'Archived'}
      initialData={analyticsData}
    />
  );
}
