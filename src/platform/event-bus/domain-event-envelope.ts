export type DomainEventEnvelope<TPayload = unknown, TEventType = string> = {
  readonly type: TEventType;
  readonly aggregateId: string;
  readonly occurredAt: Date; // TODO: should be string in UTC ISO format
  readonly payload: TPayload;
  readonly id?: string;
};
