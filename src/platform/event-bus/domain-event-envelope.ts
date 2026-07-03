type EventEnvelopeCore<TPayload = unknown, TEventType = string> = {
  readonly type: TEventType;
  readonly aggregateId: string;
  readonly occurredAt: Date; // TODO: should be string in UTC ISO format
  readonly payload: TPayload;
};

/** Written to outbox — delivery id is assigned by the repository on insert. */
export type IntegrationEvent<
  TPayload = unknown,
  TEventType = string,
> = EventEnvelopeCore<TPayload, TEventType>;

/** Adds the outbox row id after delivery. */
export type Delivered<E> = E & { readonly id: string };

export const asDelivered = <T extends IntegrationEvent>(
  event: T,
  id: string,
): Delivered<T> => ({
  ...event,
  id,
});
