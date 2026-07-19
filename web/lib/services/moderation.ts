/**
 * Content Reporting and Moderation (Req 36.2, 36.5).
 *
 * Allows authenticated users to flag public event content. Creates audit
 * records. Surfaces reports for Platform Admin review with dismiss/warn/unpublish.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { writeAuditRecord } from "./audit";
import { createNotification } from "./notification";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { PlatformRole } from "@/types";

export type ReportReason =
  | "inappropriate_content"
  | "spam"
  | "misleading"
  | "copyright"
  | "other";

export type ModerationAction = "dismiss" | "warn" | "unpublish";

/**
 * Report public event content (Req 36.2).
 */
export async function reportContent(params: {
  reporterId: string;
  eventId: string;
  reason: ReportReason;
  description?: string;
}): Promise<{ reportId: string }> {
  const supabase = createServiceClient();

  // Verify event exists and is public
  const { data: event } = await supabase
    .from("events")
    .select("id, state")
    .eq("id", params.eventId)
    .single();

  if (!event) throw new NotFoundError("Event not found.");
  if (event.state === "Draft") {
    throw new BadRequestError("Cannot report draft events.");
  }

  // Create audit record for the report
  const auditId = await writeAuditRecord({
    action: "content.report",
    actor_id: params.reporterId,
    event_id: params.eventId,
    resource_type: "events",
    resource_id: params.eventId,
    metadata: {
      reason: params.reason,
      description: params.description ?? null,
    },
  });

  return { reportId: auditId };
}

/**
 * Take moderation action (Req 36.5). Platform Admin only.
 */
export async function moderateContent(params: {
  moderatorId: string;
  moderatorRole: PlatformRole;
  eventId: string;
  action: ModerationAction;
  note?: string;
}): Promise<void> {
  // Only Platform Admins can moderate (Req 36.5)
  if (params.moderatorRole !== "PlatformAdmin") {
    throw new ForbiddenError("Only Platform Admins can perform moderation actions.");
  }

  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("id", params.eventId)
    .single();

  if (!event) throw new NotFoundError("Event not found.");

  if (params.action === "unpublish") {
    // Move event back to Draft
    await supabase
      .from("events")
      .update({ state: "Draft" })
      .eq("id", params.eventId);
  }

  // Notify organizer
  if (params.action === "warn" || params.action === "unpublish") {
    await createNotification({
      userId: event.organizer_id,
      category: "system",
      title: `Content moderation: ${params.action}`,
      body: params.note ?? `Your event has been ${params.action === "unpublish" ? "unpublished" : "warned"} by a moderator.`,
      eventId: params.eventId,
    });
  }

  await writeAuditRecord({
    action: "content.moderate",
    actor_id: params.moderatorId,
    event_id: params.eventId,
    resource_type: "events",
    resource_id: params.eventId,
    metadata: {
      moderation_action: params.action,
      note: params.note ?? null,
    },
  });
}
