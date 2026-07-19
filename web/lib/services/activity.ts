/**
 * Activity log service — append entries to event activity timeline (Req 28.3).
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export type ActivityAction =
  | "event.created"
  | "event.state_changed"
  | "event.member_joined"
  | "event.member_left"
  | "team.created"
  | "team.member_joined"
  | "submission.created"
  | "submission.updated"
  | "evaluation.submitted"
  | "escrow.funded"
  | "escrow.disbursed"
  | "escrow.refunded"
  | "dispute.filed"
  | "dispute.resolved"
  | "winner.declared";

export type ResourceType =
  | "event"
  | "team"
  | "submission"
  | "evaluation"
  | "escrow"
  | "dispute"
  | "winner";

interface LogActivityParams {
  eventId: string;
  actorId?: string;
  action: ActivityAction;
  resourceType: ResourceType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append an activity entry. Non-blocking — errors are logged but not thrown.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = createServiceClient();

    await supabase.from("activity_log").insert({
      event_id: params.eventId,
      actor_id: params.actorId ?? null,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error("[activity] Failed to log activity:", err);
  }
}

/**
 * Fetch activity timeline for an event.
 */
export async function getEventActivity(
  eventId: string,
  limit = 50,
  offset = 0,
): Promise<{ data: unknown[]; total: number }> {
  const supabase = createServiceClient();

  const { data, count } = await supabase
    .from("activity_log")
    .select("*", { count: "exact" })
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return { data: data ?? [], total: count ?? 0 };
}
