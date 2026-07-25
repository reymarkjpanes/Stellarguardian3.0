/**
 * Notification & Activity Timeline Service (Req 2.8, 16.1-16.6, 28.2-28.6).
 *
 * Creates in-app notifications, delivers via Supabase realtime (≤5s),
 * sends email via Resend for high-priority categories, honors per-category
 * preferences, batches non-urgent into hourly digests.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export type NotificationCategory =
  | "dispute"
  | "disbursement"
  | "security"
  | "escrow"
  | "team"
  | "submission"
  | "evaluation"
  | "event_update"
  | "milestone"
  | "invitation"
  | "system";

export type NotificationPriority = "urgent" | "normal";

/** Categories that always deliver immediately (Req 16.6). */
const URGENT_CATEGORIES: ReadonlySet<NotificationCategory> = new Set([
  "dispute",
  "disbursement",
  "security",
  "escrow",
]);

export interface CreateNotificationParams {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  eventId?: string;
  workspaceId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an in-app notification (Req 16.1, 28.2).
 * Urgent categories trigger immediate email delivery; normal ones are
 * batched for hourly digest.
 */
export async function createNotification(params: CreateNotificationParams): Promise<string> {
  const supabase = createServiceClient();
  const priority: NotificationPriority = URGENT_CATEGORIES.has(params.category)
    ? "urgent"
    : "normal";

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: params.userId,
      category: params.category,
      priority,
      title: params.title,
      body: params.body,
      event_id: params.eventId ?? null,
      workspace_id: params.workspaceId ?? null,
      action_url: params.actionUrl ?? null,
      metadata: params.metadata ?? {},
      read: false,
      email_sent: false,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[notification] Failed to create notification:", error.message);
    return "";
  }

  // For urgent categories, send email immediately (Req 16.6, 28.5)
  if (priority === "urgent") {
    await sendNotificationEmail(params.userId, params.category, params.title, params.body, data.id);
  }

  return data.id;
}

/**
 * Send a notification email via Resend (Req 16.2, 28.5).
 * Only sends if the user has not disabled email for this category.
 */
async function sendNotificationEmail(
  userId: string,
  category: NotificationCategory,
  title: string,
  body: string,
  notificationId: string,
): Promise<void> {
  const supabase = createServiceClient();

  // Get user email
  const { data: user } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .single();

  if (!user?.email) return;

  // Check per-category email preferences (Req 16.3, 28.6)
  // Users can disable email for specific notification categories
  const { data: preference } = await supabase
    .from("notification_preferences")
    .select("email_enabled")
    .eq("user_id", userId)
    .eq("category", category)
    .maybeSingle();

  // If the user has explicitly disabled emails for this category, skip
  if (preference && preference.email_enabled === false) return;

  try {
    // Dynamic import to keep Resend out of initial bundle
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Stellar Guardian <noreply@stellarguardian.io>",
      to: user.email,
      subject: title,
      html: `<h2>${title}</h2><p>${body}</p>`,
    });

    // Mark email as sent
    await supabase
      .from("notifications")
      .update({ email_sent: true })
      .eq("id", notificationId);
  } catch (err) {
    console.error("[notification] Email send failed:", err);
  }
}

/**
 * Mark notifications as read (Req 16.1).
 */
export async function markNotificationsRead(
  userId: string,
  notificationIds: string[],
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .in("id", notificationIds)
    .eq("user_id", userId);
}

/**
 * Get the activity timeline for an event (Req 28.3).
 * Derives a chronological feed from audit records + notifications.
 */
export async function getActivityTimeline(
  eventId: string,
  cursor?: string,
  limit = 20,
): Promise<{
  data: Array<{
    id: string;
    type: string;
    actor_id: string;
    description: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }>;
  meta: { cursor: string | null; hasMore: boolean };
}> {
  const supabase = createServiceClient();
  const safeLimit = Math.min(limit, 50);

  let query = supabase
    .from("audit_records")
    .select("id, action, actor_id, metadata, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;

  if (error) throw new Error(`Activity timeline query failed: ${error.message}`);

  const records = (data ?? []).map((r) => ({
    id: r.id,
    type: r.action,
    actor_id: r.actor_id,
    description: formatAuditAction(r.action, r.metadata),
    created_at: r.created_at,
    metadata: r.metadata ?? {},
  }));

  const hasMore = records.length === safeLimit;
  const nextCursor = hasMore ? records[records.length - 1]?.created_at : null;

  return { data: records, meta: { cursor: nextCursor, hasMore } };
}

function formatAuditAction(action: string, metadata: Record<string, unknown> | null): string {
  const descriptions: Record<string, string> = {
    "event.create": "Event created",
    "event.update": "Event updated",
    "event.state_transition": `Event moved to ${metadata?.to_state ?? "new state"}`,
    "escrow.fund": "Escrow funded",
    "escrow.lock": "Escrow locked",
    "escrow.disburse": "Prize disbursement executed",
    "escrow.refund": "Escrow refunded",
    "dispute.create": "Dispute filed",
    "dispute.transition": `Dispute moved to ${metadata?.to_state ?? "new state"}`,
    "team.create": "Team created",
    "team.member_join": "Team member joined",
    "submission.create": "Submission created",
    "evaluation.create": "Evaluation submitted",
    "winner.assign": "Winners assigned",
  };
  return descriptions[action] ?? action.replace(/\./g, " ").replace(/_/g, " ");
}
