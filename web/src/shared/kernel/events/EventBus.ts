export interface DomainEvent {
  type: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export interface EventSubscriber {
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
  unsubscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}
