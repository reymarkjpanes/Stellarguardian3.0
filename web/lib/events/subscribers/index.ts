/**
 * Domain event subscriber bootstrapper (Task 4.3).
 *
 * Call `bootstrapEventSubscribers()` once at application startup (server-only).
 * After bootstrapping, all domain events published via `publishDomainEvent()`
 * will be routed to the registered handlers via the in-memory eventBus.
 *
 * Currently the publisher (`lib/events/publisher.ts`) handles audit+notifications
 * inline. This bootstrapper wires additional side-effect handlers that the
 * publisher delegates out to the eventBus for fan-out.
 */
import "server-only";
import { eventBus } from "@/lib/domain/events";
import { handleFundingCompleted, handlePrizeReleased } from "./escrow-events";
import { handleDisputeFiled, handleEventStateChanged } from "./notification-events";

let bootstrapped = false;

export function bootstrapEventSubscribers(): void {
  if (bootstrapped) return; // idempotent — safe to call multiple times
  bootstrapped = true;

  // Escrow lifecycle events
  eventBus.subscribe(
    "FundingCompleted",
    handleFundingCompleted as Parameters<typeof eventBus.subscribe>[1],
  );
  eventBus.subscribe(
    "PrizeReleased",
    handlePrizeReleased as Parameters<typeof eventBus.subscribe>[1],
  );

  // Notification routing events
  eventBus.subscribe(
    "DisputeFiled",
    handleDisputeFiled as Parameters<typeof eventBus.subscribe>[1],
  );
  eventBus.subscribe(
    "EventStateChanged",
    handleEventStateChanged as Parameters<typeof eventBus.subscribe>[1],
  );
}
