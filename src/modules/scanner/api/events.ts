import type { DomainEventEnvelope } from '../../../platform/event-bus/domain-event-envelope.js';

export const ScannerEventType = {
  NewReleaseDetected: 'NewReleaseDetected',
} as const;

export type NewReleaseDetectedEvent = DomainEventEnvelope<
  {
    email: string;
    repo: string;
    tag: string;
    releaseName: string;
    unsubscribeToken: string;
  },
  typeof ScannerEventType.NewReleaseDetected
>;

export type ScannerPublicApiEvent = NewReleaseDetectedEvent;
