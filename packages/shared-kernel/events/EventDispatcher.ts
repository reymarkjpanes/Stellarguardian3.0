import { DomainEvent } from "../interfaces/DomainEvent";

export interface EventHandler<TEvent extends DomainEvent = DomainEvent> {
  handle(event: TEvent): Promise<void>;
}

export class EventDispatcher {
  private handlers = new Map<string, EventHandler[]>();

  public register(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  public async dispatch(event: DomainEvent): Promise<void> {
    const eventHandlers = this.handlers.get(event.type) || [];
    
    // Process handlers in parallel or sequentially depending on need
    // For now, sequentially
    for (const handler of eventHandlers) {
      try {
        await handler.handle(event);
      } catch (err) {
        console.error(`[EventDispatcher] Handler failed for event ${event.type}:`, err);
        // Do not throw here if we want to ensure other handlers run, 
        // though DLQ is better for true robustness.
      }
    }
  }
}
