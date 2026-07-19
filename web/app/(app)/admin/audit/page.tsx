/**
 * Admin audit log page — view all audit records (Req 31).
 */
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AuditLogPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: records } = await supabase
    .from("audit_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Immutable record of all platform actions
          </p>
        </div>
        <a href="/admin" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Back to Admin
        </a>
      </div>

      {records && records.length > 0 ? (
        <div className="space-y-2">
          {records.map((record) => (
            <div key={record.id} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[var(--text)]">
                  {record.action}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(record.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-[var(--text-muted)]">
                <span>Actor: {record.actor_id?.slice(0, 8) ?? "system"}…</span>
                <span>Resource: {record.resource_type}/{record.resource_id?.slice(0, 8)}…</span>
              </div>
              {record.metadata && Object.keys(record.metadata).length > 0 && (
                <pre className="mt-2 text-xs bg-[var(--bg-muted)] p-2 rounded overflow-x-auto">
                  {JSON.stringify(record.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No audit records found.</p>
        </div>
      )}
    </main>
  );
}
