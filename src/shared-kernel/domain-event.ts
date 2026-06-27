export class DomainEvent<T = unknown> {
  constructor(
    public readonly aggregateId: string,
    public readonly payload: T,
    public readonly occurredAt: Date,
    public readonly type: string,
  ) {}
}
