/**
 * Domain Event Publisher
 *
 * Decouples core business logic from side effects like Audit and Notifications.
 * Instead of TeamService calling NotificationService directly, TeamService publishes
 * a DomainEvent, and the publisher routes it to the appropriate handlers.
 */
import "server-only";
import { writeAuditRecord } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notification";

export type DomainEvent =
  | { type: "TeamCreated"; eventId: string; teamId: string; captainId: string; teamName: string }
  | {
      type: "TeamJoinRequestResolved";
      eventId: string;
      teamId: string;
      userId: string;
      action: "accept" | "reject";
      resolvedBy: string;
    }
  | {
      type: "SubmissionCreated";
      eventId: string;
      teamId: string | null;
      submitterId: string;
      submissionId: string;
      version: number;
    }
  | {
      type: "FundingCompleted";
      eventId: string;
      escrowId: string;
      txHash: string;
      amount: string;
      fundingWallet: string;
      newState: string;
      actorId: string;
    }
  | {
      type: "PrizeReleased";
      eventId: string;
      escrowId: string;
      paidCount: number;
      heldCount: number;
      actorId: string;
    };

export async function publishDomainEvent(event: DomainEvent): Promise<void> {
  try {
    switch (event.type) {
      case "TeamCreated":
        await writeAuditRecord({
          action: "team.create",
          actor_id: event.captainId,
          event_id: event.eventId,
          resource_type: "teams",
          resource_id: event.teamId,
          metadata: { team_name: event.teamName },
        });
        break;

      case "TeamJoinRequestResolved":
        await writeAuditRecord({
          action: "team.member_join",
          actor_id: event.resolvedBy,
          event_id: event.eventId,
          resource_type: "teams",
          resource_id: event.teamId,
          metadata: { target_user_id: event.userId, action: event.action },
        });
        await createNotification({
          userId: event.userId,
          category: "team",
          title: `Team Join Request ${event.action === "accept" ? "Accepted" : "Rejected"}`,
          body: `Your request to join the team has been ${event.action}.`,
          eventId: event.eventId,
        });
        break;

      case "SubmissionCreated":
        await writeAuditRecord({
          action: "submission.create",
          actor_id: event.submitterId,
          event_id: event.eventId,
          resource_type: "submissions",
          resource_id: event.submissionId,
          metadata: { team_id: event.teamId, version: event.version },
        });
        break;

      case "FundingCompleted":
        await writeAuditRecord({
          action: "escrow.fund",
          actor_id: event.actorId,
          event_id: event.eventId,
          resource_type: "escrow_accounts",
          resource_id: event.escrowId,
          tx_hash: event.txHash,
          wallet_address: event.fundingWallet,
          amount: event.amount,
          on_chain_status: "confirmed",
          metadata: { new_state: event.newState },
        });
        // Could notify organizers here
        break;

      case "PrizeReleased":
        await writeAuditRecord({
          action: "escrow.disburse",
          actor_id: event.actorId,
          event_id: event.eventId,
          resource_type: "escrow_accounts",
          resource_id: event.escrowId,
          metadata: { paid_count: event.paidCount, held_count: event.heldCount },
        });
        break;

      default: {
        // TypeScript exhaustive check — event is `never` here if all cases are covered
        const exhaustive: never = event;
        console.warn(
          "[DomainEventPublisher] Unhandled event type:",
          (exhaustive as { type: string }).type,
        );
      }
    }
  } catch (error) {
    // Non-blocking error handling for side effects
    console.error("[DomainEventPublisher] Failed to process event:", error);
  }
}
