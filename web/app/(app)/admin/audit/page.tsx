/**
 * Admin audit log page — view all audit records (Req 31).
 *
 * Uses createServiceClient (bypasses RLS) so all platform records are visible,
 * not just those belonging to the currently logged-in admin (H11 fix).
 */
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";

export default async function AuditLogPage() {
  // Auth gate — still use the cookie client to verify the admin session
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Use service client so RLS does not filter platform-wide records (H11)
  const serviceClient = createServiceClient();

  // Also resolve actor display names for readability (M11)
  const { data: records } = await serviceClient
    .from("audit_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  // Collect unique actor UUIDs (skip "system")
  const actorIds = [
    ...new Set(
      (records ?? [])
        .map((r) => r.actor_id)
        .filter((id): id is string => typeof id === "string" && id !== "system"),
    ),
  ];

  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: users } = await serviceClient
      .from("users")
      .select("id, display_name, email")
      .in("id", actorIds);
    for (const u of users ?? []) {
      actorNames.set(u.id, u.display_name ?? u.email ?? u.id.slice(0, 8));
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Immutable record of all platform actions
          </p>
        </div>
        <BackButton href="/admin" label="Back to Admin" />
      </div>

      {records && records.length > 0 ? (
        <div className="space-y-2">
          {records.map((record) => {
            const actorDisplay =
              record.actor_id === "system"
                ? "⚙ system"
                : (actorNames.get(record.actor_id) ?? record.actor_id?.slice(0, 8) + "…");

            return (
              <div key={record.id} className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--text)]">{record.action}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(record.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-[var(--text-muted)]">
                  <span>Actor: {actorDisplay}</span>
                  <span>
                    Resource: {record.resource_type}/{record.resource_id?.slice(0, 8)}…
                  </span>
                </div>
                {record.metadata && Object.keys(record.metadata).length > 0 && (
                  <pre className="mt-2 text-xs bg-[var(--bg-muted)] p-2 rounded overflow-x-auto">
                    {JSON.stringify(record.metadata, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No audit records found.</p>
        </div>
      )}
    </main>
  );
}
