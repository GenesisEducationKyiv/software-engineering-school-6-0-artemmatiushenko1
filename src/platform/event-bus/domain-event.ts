export class DomainEvent<T = unknown> {
  constructor(
    public readonly payload: T,
    public readonly occurredAt: Date,
    public readonly version: number,
    public readonly type: string,
    public readonly aggregateId: string,
  ) {}
}
