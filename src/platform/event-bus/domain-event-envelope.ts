type EventEnvelopeCore<TPayload = unknown, TEventType = string> = {
  readonly type: TEventType;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
};

/** Written to outbox — delivery id is assigned by the repository on insert. */
export type IntegrationEvent<
  TPayload = unknown,
  TEventType = string,
> = EventEnvelopeCore<TPayload, TEventType>;

/** Adds the outbox row id after delivery. */
export type Delivered<E> = E & { readonly id: string };
