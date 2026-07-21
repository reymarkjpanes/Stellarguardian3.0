/**
 * Platform Admin Dashboard (Phase 2.11).
 *
 * Server Component showing platform-wide metrics, recent events,
 * and quick-access admin actions. Requires PlatformAdmin role.
 *
 * Design: Data-dense dashboard. KPI cards at top, tables below.
 * CSS variables. System font. No decoration beyond data.
 */
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export default async function AdminDashboardPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check admin status
  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) {
    redirect("/dashboard");
  }

  // Parallel fetch platform metrics
  const [
    { count: userCount },
    { count: eventCount },
    { count: activeEventCount },
    { count: disputeCount },
    { data: recentEvents },
    { data: recentAudit },
    { data: escrowStats },
  ] = await Promise.all([
    serviceClient.from("users").select("id", { count: "exact", head: true }),
    serviceClient.from("events").select("id", { count: "exact", head: true }),
    serviceClient
      .from("events")
      .select("id", { count: "exact", head: true })
      .not("state", "in", "(Completed,Cancelled,Archived,Draft)"),
    serviceClient
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .in("state", ["Open", "UnderReview"]),
    serviceClient
      .from("events")
      .select("id, title, state, created_at, organizer_id")
      .order("created_at", { ascending: false })
      .limit(10),
    serviceClient
      .from("audit_records")
      .select("id, action, actor_id, event_id, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    serviceClient
      .from("escrow_accounts")
      .select("state, expected_balance"),
  ]);

  // Calculate total escrow value
  const totalEscrowValue = (escrowStats ?? []).reduce(
    (sum, e) => sum + Number(e.expected_balance ?? 0),
    0,
  );
  const fundedEscrows = (escrowStats ?? []).filter((e) =>
    ["FullyFunded", "Locked", "PendingRelease"].includes(e.state),
  ).length;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Platform Administration
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          System-wide overview and management tools.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Users" value={String(userCount ?? 0)} />
        <KpiCard label="Active Events" value={String(activeEventCount ?? 0)} detail={`${eventCount ?? 0} total`} />
        <KpiCard label="Open Disputes" value={String(disputeCount ?? 0)} variant={disputeCount && disputeCount > 0 ? "warning" : "default"} />
        <KpiCard label="Escrow Value" value={`${totalEscrowValue.toFixed(2)} XLM`} detail={`${fundedEscrows} funded`} />
      </div>

      {/* Recent Events */}
      <section>
        <h2 className="text-lg font-medium text-[var(--text)] mb-3">Recent Events</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                <th className="text-left px-4 py-2 font-medium text-[var(--text-muted)]">Title</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--text-muted)]">State</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--text-muted)]">Created</th>
              </tr>
            </thead>
            <tbody>
              {(recentEvents ?? []).map((event) => (
                <tr key={event.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <a href={`/events/${event.id}`} className="text-[var(--text)] hover:text-[var(--accent)] font-medium">
                      {event.title}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[var(--badge-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--badge-text)]">
                      {event.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {new Date(event.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(!recentEvents || recentEvents.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[var(--text-muted)]">
                    No events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Audit Log */}
      <section>
        <h2 className="text-lg font-medium text-[var(--text)] mb-3">Recent Audit Activity</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                <th className="text-left px-4 py-2 font-medium text-[var(--text-muted)]">Action</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--text-muted)]">Actor</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--text-muted)]">Time</th>
              </tr>
            </thead>
            <tbody>
              {(recentAudit ?? []).map((record) => (
                <tr key={record.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text)]">
                    {record.action}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                    {record.actor_id === "system" ? "⚙ system" : record.actor_id.slice(0, 8) + "…"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {new Date(record.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!recentAudit || recentAudit.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[var(--text-muted)]">
                    No audit records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  detail,
  variant = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  variant?: "default" | "warning";
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold"
        style={{ color: variant === "warning" ? "var(--warning)" : "var(--text)" }}
      >
        {value}
      </p>
      {detail && (
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{detail}</p>
      )}
    </div>
  );
}
