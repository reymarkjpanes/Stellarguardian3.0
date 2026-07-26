import postgres from "postgres";
import { DomainEvent, EventPublisher } from "./EventBus";

export class OutboxPublisher implements EventPublisher {
  constructor(private sql: postgres.Sql) {}

  /**
   * Saves the domain event to the outbox table within the current transaction.
   */
  async publish(event: DomainEvent): Promise<void> {
    await this.sql`
      INSERT INTO outbox_events (
        event_type, 
        aggregate_id, 
        aggregate_type, 
        payload, 
        metadata
      ) VALUES (
        ${event.type}, 
        ${event.aggregateId}, 
        ${event.aggregateType}, 
        ${this.sql.json(event.payload as unknown as { [key: string]: postgres.JSONValue })}, 
        ${this.sql.json((event.metadata ?? {}) as unknown as { [key: string]: postgres.JSONValue })}
      )
    `;
  }
}
