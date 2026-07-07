import { Counter, Gauge } from 'prom-client';
import type { OutboxMetrics } from './outbox-metrics.interface.js';

export class PrometheusOutboxMetrics implements OutboxMetrics {
  private readonly outboxRelayFailures = new Counter({
    name: 'outbox_relay_failures_total',
    help: 'Total number of outbox relay delivery failures',
    labelNames: ['event_type'],
  });

  private readonly outboxDeadLetters = new Counter({
    name: 'outbox_dead_letters_total',
    help: 'Total number of outbox messages moved to dead letter',
    labelNames: ['event_type'],
  });

  private readonly outboxPendingMessages = new Gauge({
    name: 'outbox_pending_messages',
    help: 'Current number of pending outbox messages',
  });

  private readonly outboxDeadLetterMessages = new Gauge({
    name: 'outbox_dead_letter_messages',
    help: 'Current number of dead-lettered outbox messages',
  });

  private readonly outboxOldestPendingAgeSeconds = new Gauge({
    name: 'outbox_oldest_pending_age_seconds',
    help: 'Age in seconds of the oldest pending outbox message',
  });

  incrementOutboxRelayFailures(eventType: string): void {
    this.outboxRelayFailures.inc({ event_type: eventType });
  }

  incrementOutboxDeadLetters(eventType: string): void {
    this.outboxDeadLetters.inc({ event_type: eventType });
  }

  setOutboxPendingMessages(count: number): void {
    this.outboxPendingMessages.set(count);
  }

  setOutboxDeadLetterMessages(count: number): void {
    this.outboxDeadLetterMessages.set(count);
  }

  setOutboxOldestPendingAgeSeconds(ageSeconds: number): void {
    this.outboxOldestPendingAgeSeconds.set(ageSeconds);
  }
}
