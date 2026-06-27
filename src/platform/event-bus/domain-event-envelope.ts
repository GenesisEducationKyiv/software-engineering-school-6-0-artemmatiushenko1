// TODO: add generic parameter for event type
export type DomainEventEnvelope<TPayload = unknown> = {
  readonly type: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
};
