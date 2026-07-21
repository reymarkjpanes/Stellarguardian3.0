type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

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

    // Await all handlers; log individual failures without blocking the caller
    const results = await Promise.allSettled(
      eventHandlers.map(async (handler) => handler(payload)),
    );

    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(
          `[DomainEventBus] Handler ${i} failed for event "${eventName}":`,
          result.reason,
        );
      }
    });
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
