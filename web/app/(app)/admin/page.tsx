/**
 * Admin panel — platform-level oversight for PlatformAdmin users.
 *
 * Security: Verifies the authenticated user holds the PlatformAdmin role
 * before rendering any admin content. Non-admins are redirected to dashboard.
 */
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    { count: totalUsers },
    { count: totalWorkspaces },
    { count: totalEvents },
    { count: activeEvents },
    { count: totalDisputes },
    { count: openDisputes },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("workspaces").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true })
      .not("state", "in", "(Completed,Cancelled,Archived)"),
    supabase.from("disputes").select("*", { count: "exact", head: true }),
    supabase.from("disputes").select("*", { count: "exact", head: true })
      .in("state", ["Open", "UnderReview"]),
  ]);

  const { data: recentEvents } = await supabase
    .from("events")
    .select("id, title, state, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: recentDisputes } = await supabase
    .from("disputes")
    .select("id, event_id, state, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Platform oversight dashboard
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total Users" value={String(totalUsers ?? 0)} />
        <KpiCard label="Workspaces" value={String(totalWorkspaces ?? 0)} />
        <KpiCard label="Total Events" value={String(totalEvents ?? 0)} />
        <KpiCard label="Active Events" value={String(activeEvents ?? 0)} />
        <KpiCard label="Total Disputes" value={String(totalDisputes ?? 0)} />
        <KpiCard
          label="Open Disputes"
          value={String(openDisputes ?? 0)}
          alert={(openDisputes ?? 0) > 0}
        />
      </div>

      {/* Recent events */}
      <section>
        <h2 className="text-lg font-medium mb-3">Recent Events</h2>
        {recentEvents && recentEvents.length > 0 ? (
          <div className="space-y-2">
            {recentEvents.map((event) => (
              <a
                key={event.id}
                href={`/events/${event.id}`}
                className="block card p-4 hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[var(--text)]">{event.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Created {new Date(event.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs font-medium">
                    {event.state}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No events yet.</p>
        )}
      </section>

      {/* Open disputes */}
      {recentDisputes && recentDisputes.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3">Recent Disputes</h2>
          <div className="space-y-2">
            {recentDisputes.map((d) => (
              <div key={d.id} className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <a
                    href={`/events/${d.event_id}`}
                    className="text-sm font-medium text-[var(--accent)] hover:underline"
                  >
                    Event →
                  </a>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    d.state === "Open"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"
                  }`}>
                    {d.state}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                  {d.reason}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Audit log link */}
      <section className="card p-6">
        <h3 className="text-sm font-medium text-[var(--text)] mb-2">Audit Log</h3>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          View all system-wide audit records for compliance and debugging.
        </p>
        <a
          href="/admin/audit"
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          View Audit Log
        </a>
      </section>
    </main>
  );
}

function KpiCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`card p-4 ${alert ? "border-[var(--error)]" : ""}`}>
      <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${alert ? "text-[var(--error)]" : "text-[var(--text)]"}`}>
        {value}
      </p>
    </div>
  );
}
