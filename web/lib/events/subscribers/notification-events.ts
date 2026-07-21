/**
 * Notification domain event subscribers (Task 4.3).
 * Handles DisputeFiled and other cross-domain notification events.
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { createNotification } from "@/lib/services/notification";
import { logger } from "@/lib/logger";

export interface DisputeFiledPayload {
  type: "DisputeFiled";
  eventId: string;
  disputeId: string;
  submissionId: string;
  filedById: string;
}

export interface EventStateChangedPayload {
  type: "EventStateChanged";
  eventId: string;
  previousState: string;
  newState: string;
  actorId: string;
}

export async function handleDisputeFiled(event: DisputeFiledPayload): Promise<void> {
  try {
    const supabase = createServiceClient();

    // Notify the organizer
    const { data: eventRow } = await supabase
      .from("events")
      .select("organizer_id, title")
      .eq("id", event.eventId)
      .maybeSingle();

    if (eventRow?.organizer_id) {
      await createNotification({
        userId: eventRow.organizer_id,
        category: "dispute",
        title: "Dispute filed",
        body: `A new dispute has been filed for "${eventRow.title ?? event.eventId}".`,
        eventId: event.eventId,
      });
    }

    logger.info("[notification-events] DisputeFiled handled", {
      eventId: event.eventId,
      disputeId: event.disputeId,
    });
  } catch (err) {
    logger.error("[notification-events] handleDisputeFiled failed", { error: String(err) });
    throw err;
  }
}

export async function handleEventStateChanged(event: EventStateChangedPayload): Promise<void> {
  try {
    const supabase = createServiceClient();

    const { data: eventRow } = await supabase
      .from("events")
      .select("organizer_id, title")
      .eq("id", event.eventId)
      .maybeSingle();

    if (eventRow?.organizer_id) {
      await createNotification({
        userId: eventRow.organizer_id,
        category: "event_update",
        title: `Event moved to ${event.newState}`,
        body: `"${eventRow.title ?? event.eventId}" transitioned from ${event.previousState} → ${event.newState}.`,
        eventId: event.eventId,
      });
    }

    logger.info("[notification-events] EventStateChanged handled", {
      eventId: event.eventId,
      previousState: event.previousState,
      newState: event.newState,
    });
  } catch (err) {
    logger.error("[notification-events] handleEventStateChanged failed", { error: String(err) });
    throw err;
  }
}
