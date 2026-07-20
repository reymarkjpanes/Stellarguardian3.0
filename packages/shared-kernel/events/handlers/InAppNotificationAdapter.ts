import { DomainEvent } from "../domain/EventDispatcher";

export interface NotificationAdapter {
  send(event: DomainEvent): Promise<void>;
}

export class InAppNotificationAdapter implements NotificationAdapter {
  async send(event: DomainEvent): Promise<void> {
    // Write to a 'notifications' table in Supabase to be consumed by the UI bell icon
    console.log(`[InAppNotification] Creating notification for event: ${event.type}`);
  }
}
