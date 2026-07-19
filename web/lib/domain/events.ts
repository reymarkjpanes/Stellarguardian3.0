type EventHandler<T = any> = (payload: T) => void | Promise<void>;

class DomainEventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  subscribe<T>(eventName: string, handler: EventHandler<T>) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
  }

  async publish<T>(eventName: string, payload: T) {
    const eventHandlers = this.handlers.get(eventName);
    if (!eventHandlers) return;

    // Fire all handlers asynchronously (non-blocking)
    // We don't await them sequentially because side-effects shouldn't block the main thread
    Promise.allSettled(
      eventHandlers.map(async (handler) => {
        try {
          await handler(payload);
        } catch (error) {
          console.error(`[DomainEventBus] Error in handler for event ${eventName}:`, error);
        }
      })
    );
  }
}

export const eventBus = new DomainEventBus();

// Core Event Types
export type EventCreatedPayload = {
  eventId: string;
  workspaceId: string;
  organizerId: string;
  title: string;
};

// ... we will add more event types and register subscribers here or in a separate bootstrapper
