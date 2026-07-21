/**
 * Event sub-navigation layout (Task 2.5).
 *
 * Wraps all event sub-pages with the event title, state badge, and a
 * horizontal tab bar. Active tab is determined by the current pathname.
 * Responsive: scrollable on mobile.
 */
import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { EventSubNav } from "@/components/events/event-sub-nav";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, state, organizer_id")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const isOrganizer = user?.id === event.organizer_id;

  return (
    <div className="space-y-0">
      <EventSubNav
        eventId={id}
        eventTitle={event.title}
        eventState={event.state}
        isOrganizer={isOrganizer}
      />
      <div className="pt-6">{children}</div>
    </div>
  );
}
