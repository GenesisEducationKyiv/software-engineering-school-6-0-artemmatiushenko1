import type { DomainEventEnvelope } from '../../../platform/event-bus/domain-event-envelope.js';

export const ScannerEventType = {
  NewReleaseDetected: 'NewReleaseDetected',
} as const;

export type NewReleaseDetectedEvent = DomainEventEnvelope<
  {
    repo: string;
    tag: string;
    releaseName: string;
  },
  typeof ScannerEventType.NewReleaseDetected
>;
