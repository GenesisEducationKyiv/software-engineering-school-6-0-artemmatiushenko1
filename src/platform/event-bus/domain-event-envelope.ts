export type DomainEventEnvelope<TPayload = unknown, TEventType = string> = {
  readonly type: TEventType;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
};
