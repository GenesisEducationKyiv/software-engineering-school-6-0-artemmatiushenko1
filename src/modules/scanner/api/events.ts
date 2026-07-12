import type { IntegrationEvent } from '../../../platform/event-bus/domain-event-envelope.js';

export const ScannerEventType = {
  NewReleaseDetected: 'NewReleaseDetected',
} as const;

type NewReleaseDetectedPayload = {
  repo: string;
  tag: string;
  releaseName: string;
};

export type NewReleaseDetectedEvent = IntegrationEvent<
  NewReleaseDetectedPayload,
  typeof ScannerEventType.NewReleaseDetected
>;
