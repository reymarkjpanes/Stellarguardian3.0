/**
 * Role-specific dashboard (Req 29.1-29.8).
 *
 * Server Component that displays role-appropriate KPIs and quick actions.
 * Aggregates across roles with clear role-context labels.
 */
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

interface EventMembership {
  event_id: string;
  role: string;
  status: string;
  event_title: string;
  event_state: string;
}

interface WorkspaceMembership {
  workspace_id: string;
  role: string;
  workspace_name: string;
  workspace_slug: string;
}

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch user data
  const [
    { data: profile },
    { data: rawEventMemberships },
    { data: rawWorkspaceMemberships },
  ] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", user.id).single(),
    supabase
      .from("event_members")
      .select("event_id, role, status")
      .eq("user_id", user.id)
      .limit(20),
    supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id),
  ]);

  const displayName = profile?.display_name ?? user.email ?? "User";

  // Fetch event details for memberships
  const eventIds = (rawEventMemberships ?? []).map((m) => m.event_id);
  const { data: eventsData } = eventIds.length > 0
    ? await supabase.from("events").select("id, title, state").in("id", eventIds)
    : { data: [] };

  const eventsMap = new Map((eventsData ?? []).map((e) => [e.id, e]));

  const events: EventMembership[] = (rawEventMemberships ?? []).map((m) => {
    const event = eventsMap.get(m.event_id);
    return {
      event_id: m.event_id,
      role: m.role,
      status: m.status,
      event_title: event?.title ?? "Unknown",
      event_state: event?.state ?? "Unknown",
    };
  });

  // Fetch workspace details
  const workspaceIds = (rawWorkspaceMemberships ?? []).map((m) => m.workspace_id);
  const { data: workspacesData } = workspaceIds.length > 0
    ? await supabase.from("workspaces").select("id, name, slug").in("id", workspaceIds)
    : { data: [] };

  const workspacesMap = new Map((workspacesData ?? []).map((w) => [w.id, w]));

  const workspaces: WorkspaceMembership[] = (rawWorkspaceMemberships ?? []).map((m) => {
    const ws = workspacesMap.get(m.workspace_id);
    return {
      workspace_id: m.workspace_id,
      role: m.role,
      workspace_name: ws?.name ?? "Unknown",
      workspace_slug: ws?.slug ?? "",
    };
  });

  const isOrganizer = events.some((e) => e.role === "Organizer");
  const isJudge = events.some((e) => e.role === "Judge");
  const isParticipant = events.some((e) => e.role === "Participant");
  const terminalStates = new Set(["Completed", "Cancelled", "Archived"]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {displayName}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {isOrganizer && "Organizer"}
            {isOrganizer && isJudge && " · "}
            {isJudge && "Judge"}
            {(isOrganizer || isJudge) && isParticipant && " · "}
            {isParticipant && "Participant"}
            {!isOrganizer && !isJudge && !isParticipant && "Get started by joining an event"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Workspaces" value={String(workspaces.length)} />
          <KpiCard
            label="Active Events"
            value={String(events.filter((e) => !terminalStates.has(e.event_state)).length)}
          />
          <KpiCard
            label="Roles Held"
            value={String(new Set(events.map((e) => e.role)).size)}
          />
          <KpiCard
            label="Completed"
            value={String(events.filter((e) => e.event_state === "Completed").length)}
          />
        </div>

        <section>
          <h2 className="text-lg font-medium mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <QuickAction href="/workspaces/new" label="Create Workspace" />
            <QuickAction href="/events/new" label="Create Event" />
            <QuickAction href="/discover" label="Discover Events" />
          </div>
        </section>

        {events.length > 0 && (
          <section>
            <h2 className="text-lg font-medium mb-3">Your Events</h2>
            <div className="space-y-2">
              {events.slice(0, 10).map((event) => (
                <a
                  key={`${event.event_id}-${event.role}`}
                  href={`/events/${event.event_id}`}
                  className="block rounded-lg border border-neutral-200 p-4 hover:border-neutral-400 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{event.event_title}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {event.role} · {event.event_state}
                      </p>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                      {event.role}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {workspaces.length > 0 && (
          <section>
            <h2 className="text-lg font-medium mb-3">Your Workspaces</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((ws) => (
                <a
                  key={ws.workspace_id}
                  href={`/workspaces/${ws.workspace_slug}`}
                  className="rounded-lg border border-neutral-200 p-4 hover:border-neutral-400 transition-colors"
                >
                  <p className="font-medium">{ws.workspace_name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{ws.role}</p>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
    >
      {label}
    </a>
  );
}
