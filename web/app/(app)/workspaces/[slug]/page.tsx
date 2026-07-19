/**
 * Workspace detail dashboard — shows workspace info, members, and events.
 */
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!workspace) redirect("/dashboard");

  // Check membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect("/dashboard");

  // Fetch members
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspace.id);

  const memberUserIds = (members ?? []).map((m) => m.user_id);
  const { data: memberUsers } = memberUserIds.length > 0
    ? await supabase.from("users").select("id, display_name, email").in("id", memberUserIds)
    : { data: [] };

  const usersMap = new Map((memberUsers ?? []).map((u) => [u.id, u]));

  // Fetch workspace events
  const { data: events } = await supabase
    .from("events")
    .select("id, title, state, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const isAdmin = membership.role === "Owner" || membership.role === "Admin";

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            /{workspace.slug} · {membership.role}
          </p>
          {workspace.description && (
            <p className="mt-3 text-sm text-[var(--text-secondary)] max-w-2xl">
              {workspace.description}
            </p>
          )}
        </div>
        {isAdmin && (
          <a
            href={`/workspaces/${slug}/settings`}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            Settings
          </a>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Members" value={String(members?.length ?? 0)} />
        <StatCard label="Events" value={String(events?.length ?? 0)} />
        <StatCard label="Plan" value={(workspace.billing as { plan?: string })?.plan ?? "free"} />
      </div>

      {/* Events */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Events</h2>
          {isAdmin && (
            <a
              href={`/events/new?workspace=${workspace.id}`}
              className="btn-primary text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
            >
              New Event
            </a>
          )}
        </div>
        {events && events.length > 0 ? (
          <div className="space-y-2">
            {events.map((event) => (
              <a
                key={event.id}
                href={`/events/${event.id}`}
                className="block rounded-lg card p-4 hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[var(--text)]">{event.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Created {new Date(event.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                    {event.state}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No events yet.</p>
            {isAdmin && (
              <a
                href={`/events/new?workspace=${workspace.id}`}
                className="inline-block mt-3 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                Create your first event →
              </a>
            )}
          </div>
        )}
      </section>

      {/* Members */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Members</h2>
          {isAdmin && (
            <a
              href={`/workspaces/${slug}/members`}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Manage
            </a>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(members ?? []).map((m) => {
            const u = usersMap.get(m.user_id);
            return (
              <div key={m.user_id} className="card p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-sm font-semibold text-[var(--text)]">
                  {(u?.display_name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">
                    {u?.display_name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{m.role}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}
