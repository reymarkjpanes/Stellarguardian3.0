import { notFound, redirect } from "next/navigation";
import { EventSubNav } from "@/components/events/event-sub-nav";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getEventById } from "@/lib/data/event";
import { getCurrentUser } from "@/lib/data/user";
import { createServerClient } from "@/lib/supabase/server";

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

  // L4: check membership so EventSubNav can conditionally show the Register tab
  const supabase = await createServerClient();
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const isMember = !!membership;
  const memberRole = membership?.role ?? null;

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
        isMember={isMember}
        memberRole={memberRole}
      />
      <div className="pt-6">{children}</div>
    </div>
  );
}
