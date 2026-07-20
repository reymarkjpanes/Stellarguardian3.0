export interface DomainEvent<T = any> {
  eventId: string;
  aggregateId: string;
  type: string;
  payload: T;
  occurredAt: Date;
  eventVersion: number;
}
