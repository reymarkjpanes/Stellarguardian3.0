/**
 * Append-only Audit Service (Req 11.5, 23.9, 26.6, 27.11, 28.1, 28.7, 31.1-31.8, 39.5).
 *
 * Writes immutable audit records with all mandatory fields. Financial actions
 * include tx hash, wallet, amount, and on-chain confirmation status. Supports
 * filtered paginated queries and CSV/JSON export with 7-year retention.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export type AuditAction =
  | "event.create"
  | "event.update"
  | "event.state_transition"
  | "event.delete"
  | "escrow.fund"
  | "escrow.lock"
  | "escrow.disburse"
  | "escrow.refund"
  | "escrow.reconciliation"
  | "escrow.settle"
  | "wallet.challenge_issued"
  | "wallet.verified"
  | "wallet.verification_failed"
  | "dispute.create"
  | "dispute.transition"
  | "team.create"
  | "team.member_join"
  | "team.member_leave"
  | "submission.create"
  | "submission.update"
  | "evaluation.create"
  | "evaluation.conflict_of_interest"
  | "winner.assign"
  | "permission.denied"
  | "auth.login"
  | "auth.signup"
  | "workspace.create"
  | "workspace.update"
  | "workspace.member_add"
  | "workspace.member_remove"
  | "notification.sent"
  | "legal.acceptance"
  | "account.deactivate"
  | "account.delete"
  | "content.report"
  | "content.moderate";

export interface AuditRecord {
  action: AuditAction;
  actor_id: string;
  event_id?: string | null;
  workspace_id?: string | null;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  /** Financial audit fields (Req 28.7, 31.6) */
  tx_hash?: string;
  wallet_address?: string;
  amount?: string;
  on_chain_status?: "pending" | "confirmed" | "failed";
}

export interface AuditQueryOptions {
  eventId?: string;
  workspaceId?: string;
  actorId?: string;
  action?: AuditAction;
  cursor?: string;
  limit?: number;
}

/**
 * Write an immutable audit record (Req 31.1, 31.2).
 * This uses the service client to bypass RLS and write directly.
 */
export async function writeAuditRecord(record: AuditRecord): Promise<string> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("audit_records")
    .insert({
      action: record.action,
      actor_id: record.actor_id,
      event_id: record.event_id ?? null,
      workspace_id: record.workspace_id ?? null,
      resource_type: record.resource_type ?? null,
      resource_id: record.resource_id ?? null,
      metadata: record.metadata ?? {},
      tx_hash: record.tx_hash ?? null,
      wallet_address: record.wallet_address ?? null,
      amount: record.amount ?? null,
      on_chain_status: record.on_chain_status ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // Log but don't throw — audit writes should never block the primary operation
    console.error("[audit] Failed to write audit record:", error.message, record);
    return "";
  }

  return data.id;
}

/**
 * Query audit records with cursor-based pagination (Req 31.4-31.5).
 */
export async function queryAuditRecords(options: AuditQueryOptions) {
  const supabase = createServiceClient();
  const limit = Math.min(options.limit ?? 20, 50);

  let query = supabase
    .from("audit_records")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.eventId) query = query.eq("event_id", options.eventId);
  if (options.workspaceId) query = query.eq("workspace_id", options.workspaceId);
  if (options.actorId) query = query.eq("actor_id", options.actorId);
  if (options.action) query = query.eq("action", options.action);
  if (options.cursor) query = query.lt("created_at", options.cursor);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Audit query failed: ${error.message}`);
  }

  const records = data ?? [];
  const hasMore = records.length === limit;
  const nextCursor = hasMore ? records[records.length - 1]?.created_at : null;

  return {
    data: records,
    meta: {
      cursor: nextCursor,
      hasMore,
      total: count ?? 0,
    },
  };
}

/**
 * Export audit records as JSON for a given filter (Req 31.5).
 */
export async function exportAuditRecords(
  options: Omit<AuditQueryOptions, "cursor" | "limit">,
  format: "json" | "csv" = "json",
): Promise<string> {
  const supabase = createServiceClient();

  let query = supabase
    .from("audit_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10000); // Hard cap for exports

  if (options.eventId) query = query.eq("event_id", options.eventId);
  if (options.workspaceId) query = query.eq("workspace_id", options.workspaceId);
  if (options.actorId) query = query.eq("actor_id", options.actorId);
  if (options.action) query = query.eq("action", options.action);

  const { data, error } = await query;

  if (error) throw new Error(`Audit export failed: ${error.message}`);

  const records = data ?? [];

  if (format === "csv") {
    if (records.length === 0) return "";
    const headers = Object.keys(records[0]);
    const rows = records.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
    return [headers.join(","), ...rows].join("\n");
  }

  return JSON.stringify(records, null, 2);
}
