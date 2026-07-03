import type {
  IntegrationEvent,
  DeliveredEvent,
} from '../../../platform/event-bus/domain-event-envelope.js';

export const ScannerEventType = {
  NewReleaseDetected: 'NewReleaseDetected',
} as const;

type NewReleaseDetectedPayload = {
  repo: string;
  tag: string;
  releaseName: string;
};

export type NewReleaseDetectedIntegrationEvent = IntegrationEvent<
  NewReleaseDetectedPayload,
  typeof ScannerEventType.NewReleaseDetected
>;

export type NewReleaseDetectedEvent = DeliveredEvent<
  NewReleaseDetectedPayload,
  typeof ScannerEventType.NewReleaseDetected
>;

export type ScannerPublicApiEvent = NewReleaseDetectedIntegrationEvent;
