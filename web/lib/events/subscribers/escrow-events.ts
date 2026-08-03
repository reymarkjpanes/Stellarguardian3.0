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

    // Notify organizer
    if (eventRow?.organizer_id) {
      await createNotification({
        userId: eventRow.organizer_id,
        category: "disbursement",
        title: "Prize distribution complete",
        body: `${event.paidCount} winner(s) paid${event.heldCount > 0 ? `, ${event.heldCount} held (no wallet)` : ""} for "${eventRow.title ?? event.eventId}".`,
        eventId: event.eventId,
      });
    }

    // Notify each winner individually (H3)
    const { data: winners } = await supabase
      .from("winners")
      .select("recipient_id, prize_amount, disbursement_status")
      .eq("event_id", event.eventId);

    if (winners && winners.length > 0) {
      await Promise.allSettled(
        winners.map((w) => {
          const isPaid = (w.disbursement_status ?? "").toLowerCase() === "disbursed";
          const _isHeld = (w.disbursement_status ?? "").toLowerCase() === "held";
          const title = isPaid ? "🎉 Your prize has been sent!" : "Prize held — wallet required";
          const body = isPaid
            ? `${w.prize_amount} XLM has been sent to your verified wallet for "${eventRow?.title ?? event.eventId}".`
            : `Your prize of ${w.prize_amount} XLM is held because no verified wallet is on file. Go to Settings → Wallets to connect one.`;

          return createNotification({
            userId: w.recipient_id,
            category: "disbursement",
            title,
            body,
            eventId: event.eventId,
          });
        }),
      );
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
