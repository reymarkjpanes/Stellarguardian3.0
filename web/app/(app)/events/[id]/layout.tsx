import { notFound, redirect } from "next/navigation";
import { EventSubNav } from "@/components/events/event-sub-nav";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getEventById } from "@/lib/data/event";
import { getCurrentUser } from "@/lib/data/user";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, event] = await Promise.all([getCurrentUser(), getEventById(id)]);

  if (!user) redirect("/login");
  if (!event) notFound();

  const isOrganizer = user.id === event.organizer_id;

  return (
    <div className="space-y-0">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Events", href: "/dashboard" },
          { label: event.title },
        ]}
      />
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
