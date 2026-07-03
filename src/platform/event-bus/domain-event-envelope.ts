type EventEnvelopeCore<TPayload = unknown, TEventType = string> = {
  readonly type: TEventType;
  readonly aggregateId: string;
  readonly occurredAt: Date; // TODO: should be string in UTC ISO format
  readonly payload: TPayload;
};

/** Written to outbox — messageId is assigned by the repository on insert. */
export type IntegrationEvent<
  TPayload = unknown,
  TEventType = string,
> = EventEnvelopeCore<TPayload, TEventType>;

/** Published after delivery — messageId is always the outbox row id. */
export type DeliveredEvent<
  TPayload = unknown,
  TEventType = string,
> = EventEnvelopeCore<TPayload, TEventType> & {
  readonly messageId: string;
};

export const asDelivered = <T extends IntegrationEvent>(
  event: T,
  messageId: string,
): DeliveredEvent<T['payload'], T['type']> => ({
  ...event,
  messageId,
});
