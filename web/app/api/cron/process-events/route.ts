/**
 * Cron: Process domain event outbox (H3 — reliable event delivery).
 *
 * Runs every 1 minute. Reads pending events from `domain_events` table,
 * processes each (notifications, emails, side effects), marks as processed/failed.
 * Retries with exponential backoff up to max_attempts.
 *
 * Authentication: Requires Bearer CRON_SECRET in Authorization header.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createNotification } from "@/lib/services/notification";
import { sendNotificationEmail } from "@/lib/services/email";
import { logger } from "@/lib/logger";

const BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  let processed = 0;
  let failed = 0;

  // Fetch pending events ready for processing
  const { data: events } = await supabase
    .from("domain_events")
    .select("*")
    .eq("status", "pending")
    .lte("next_retry_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  for (const event of events ?? []) {
    try {
      await processEvent(event, supabase);

      await supabase
        .from("domain_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", event.id);

      processed++;
    } catch (err) {
      const newAttempts = event.attempts + 1;
      const isDead = newAttempts >= event.max_attempts;

      // Exponential backoff: 1min, 2min, 4min, 8min, 16min
      const backoffMs = Math.min(60000 * Math.pow(2, newAttempts - 1), 3600000);
      const nextRetry = new Date(Date.now() + backoffMs).toISOString();

      await supabase
        .from("domain_events")
        .update({
          status: isDead ? "dead" : "pending",
          attempts: newAttempts,
          last_error: err instanceof Error ? err.message : String(err),
          next_retry_at: isDead ? event.next_retry_at : nextRetry,
        })
        .eq("id", event.id);

      failed++;

      if (isDead) {
        logger.error("[outbox] Event permanently failed after max attempts", {
          eventId: event.id,
          type: event.type,
          error: String(err),
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    failed,
    total: (events ?? []).length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Route domain events to their handlers.
 */
interface DomainEventRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  next_retry_at: string;
}

async function processEvent(
  event: DomainEventRow,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const payload = event.payload;

  switch (event.type) {
    case "FundingCompleted": {
      // Notify organizer about successful funding
      const { data: eventRow } = await supabase
        .from("events")
        .select("organizer_id, title")
        .eq("id", payload.eventId)
        .single();

      if (eventRow) {
        await createNotification({
          userId: eventRow.organizer_id,
          category: "escrow",
          title: "Event funded successfully",
          body: `${String(payload.amount)} XLM confirmed for "${eventRow.title}".`,
          eventId: payload.eventId as string,
        });

        // Also send email for financial events
        const {
          data: { user: authUser },
        } = await supabase.auth.admin.getUserById(eventRow.organizer_id);
        if (authUser?.email) {
          await sendNotificationEmail(
            authUser.email,
            `Event funded: ${eventRow.title}`,
            `${String(payload.amount)} XLM has been confirmed in escrow for your event "${eventRow.title}".`,
            `${process.env.NEXT_PUBLIC_SITE_URL}/events/${payload.eventId as string}`,
          );
        }
      }
      break;
    }

    case "PrizeReleased": {
      // Notify organizer about disbursement completion
      const { data: eventRow } = await supabase
        .from("events")
        .select("organizer_id, title")
        .eq("id", payload.eventId)
        .single();

      if (eventRow) {
        await createNotification({
          userId: eventRow.organizer_id,
          category: "disbursement",
          title: "Prize disbursement complete",
          body: `${String(payload.paidCount)} winner(s) paid for "${eventRow.title}".`,
          eventId: payload.eventId as string,
        });
      }
      break;
    }

    case "TeamCreated":
    case "TeamJoinRequestResolved":
    case "SubmissionCreated":
      // These events have their notifications handled inline currently.
      // Processing here ensures the audit trail is complete even on retry.
      break;

    default:
      logger.warn("[outbox] Unknown event type", { type: event.type, id: event.id });
  }
}
