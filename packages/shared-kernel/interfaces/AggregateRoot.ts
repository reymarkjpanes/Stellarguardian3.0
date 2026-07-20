import { DomainEvent } from "./DomainEvent";

export abstract class AggregateRoot<TId> {
  public readonly id: TId;
  public version: number;
  private readonly _domainEvents: DomainEvent[] = [];

  constructor(id: TId, version: number = 1) {
    this.id = id;
    this.version = version;
  }

  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  protected addDomainEvent(domainEvent: DomainEvent): void {
    this._domainEvents.push(domainEvent);
  }

  public clearEvents(): void {
    this._domainEvents.length = 0;
  }
}
