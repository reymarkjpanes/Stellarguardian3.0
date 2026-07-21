/**
 * Escrow domain event subscribers (Task 4.3).
 * Handles FundingCompleted and PrizeReleased domain events.
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { createNotification } from "@/lib/services/notification";
import { logger } from "@/lib/logger";
import type { DomainEvent } from "@/lib/events/publisher";

type FundingCompletedEvent = Extract<DomainEvent, { type: "FundingCompleted" }>;
type PrizeReleasedEvent = Extract<DomainEvent, { type: "PrizeReleased" }>;

export async function handleFundingCompleted(event: FundingCompletedEvent): Promise<void> {
  try {
    const supabase = createServiceClient();

    // Notify the organizer that funding was confirmed
    const { data: eventRow } = await supabase
      .from("events")
      .select("organizer_id, title")
      .eq("id", event.eventId)
      .maybeSingle();

    if (eventRow?.organizer_id) {
      await createNotification({
        userId: eventRow.organizer_id,
        category: "escrow",
        title: "Escrow funding confirmed",
        body: `${event.amount} XLM has been confirmed in the escrow for "${eventRow.title ?? event.eventId}". Tx: ${event.txHash.slice(0, 12)}…`,
        eventId: event.eventId,
      });
    }

    logger.info("[escrow-events] FundingCompleted handled", {
      eventId: event.eventId,
      txHash: event.txHash,
      amount: event.amount,
    });
  } catch (err) {
    logger.error("[escrow-events] handleFundingCompleted failed", { error: String(err) });
    throw err; // rethrow so eventBus.publish logs it via Promise.allSettled
  }
}

export async function handlePrizeReleased(event: PrizeReleasedEvent): Promise<void> {
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
        category: "disbursement",
        title: "Prize distribution complete",
        body: `${event.paidCount} winner(s) paid${event.heldCount > 0 ? `, ${event.heldCount} held (no wallet)` : ""} for "${eventRow.title ?? event.eventId}".`,
        eventId: event.eventId,
      });
    }

    logger.info("[escrow-events] PrizeReleased handled", {
      eventId: event.eventId,
      paidCount: event.paidCount,
      heldCount: event.heldCount,
    });
  } catch (err) {
    logger.error("[escrow-events] handlePrizeReleased failed", { error: String(err) });
    throw err;
  }
}
