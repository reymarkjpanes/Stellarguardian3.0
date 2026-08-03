/**
 * Admin audit log page — view all platform audit records (Req 31, H8).
 *
 * Supports filter by:
 *   - action keyword  (?action=)
 *   - date range      (?from= and ?to=, YYYY-MM-DD)
 *   - resource type   (?resource=)
 * Passes enriched records to AuditLogClient for rendering + CSV export.
 * Uses createServiceClient to bypass RLS so all platform records are visible.
 */
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { AuditLogClient, type AuditRecord } from "./audit-log-client";

interface PageProps {
  searchParams: Promise<{
    action?: string;
    from?: string;
    to?: string;
    resource?: string;
  }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  // Auth gate — cookie client to verify admin session
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { action = "", from = "", to = "", resource = "" } = await searchParams;

  const serviceClient = createServiceClient();

  // Build filtered query
  let query = serviceClient
    .from("audit_records")
    .select("id, action, actor_id, resource_type, resource_id, metadata, event_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (action.trim()) {
    query = query.ilike("action", `%${action.trim()}%`);
  }
  if (resource.trim()) {
    query = query.ilike("resource_type", `%${resource.trim()}%`);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00.000Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59.999Z`);
  }

  const { data: rawRecords } = await query;
  const records = rawRecords ?? [];

  // Resolve actor display names
  const actorIds = [
    ...new Set(
      records
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

  const enriched: AuditRecord[] = records.map((r) => ({
    id: r.id,
    action: r.action,
    actorDisplay:
      r.actor_id === "system"
        ? "⚙ system"
        : (actorNames.get(r.actor_id) ?? (r.actor_id?.slice(0, 8) ?? "?") + "…"),
    resourceType: r.resource_type ?? "",
    resourceId: r.resource_id ?? "",
    eventId: r.event_id ?? null,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  }));

  return (
    <AuditLogClient
      records={enriched}
      filters={{ action, from, to, resource }}
      totalCount={records.length}
    />
  );
}
