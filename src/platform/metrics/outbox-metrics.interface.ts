export interface OutboxMetrics {
  incrementOutboxRelayFailures(eventType: string): void;
  incrementOutboxDeadLetters(eventType: string): void;
  setOutboxPendingMessages(count: number): void;
  setOutboxDeadLetterMessages(count: number): void;
  setOutboxOldestPendingAgeSeconds(ageSeconds: number): void;
}
