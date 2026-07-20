import { EventHandler } from "./EventDispatcher";
import { DomainEvent } from "../interfaces/DomainEvent";

export class AuditHandler implements EventHandler {
  async handle(event: DomainEvent): Promise<void> {
    console.log(`[AuditHandler] Recording event ${event.type} for aggregate ${event.aggregateId}`);
  }
}

export class NotificationHandler implements EventHandler {
  async handle(event: DomainEvent): Promise<void> {
    console.log(`[NotificationHandler] Preparing notifications for event ${event.type}`);
  }
}

export class RealtimeHandler implements EventHandler {
  async handle(event: DomainEvent): Promise<void> {
    console.log(`[RealtimeHandler] Broadcasting event ${event.type} to live clients`);
  }
}
