import { Counter, Gauge, type Registry } from 'prom-client';
import type { OutboxMetrics } from './outbox-metrics.interface.js';

export class PrometheusOutboxMetrics implements OutboxMetrics {
  private readonly outboxRelayFailures: Counter;
  private readonly outboxDeadLetters: Counter;
  private readonly outboxPendingMessages: Gauge;
  private readonly outboxDeadLetterMessages: Gauge;
  private readonly outboxOldestPendingAgeSeconds: Gauge;

  constructor(registry: Registry) {
    this.outboxRelayFailures = new Counter({
      name: 'outbox_relay_failures_total',
      help: 'Total number of outbox relay delivery failures',
      labelNames: ['event_type'],
      registers: [registry],
    });

    this.outboxDeadLetters = new Counter({
      name: 'outbox_dead_letters_total',
      help: 'Total number of outbox messages moved to dead letter',
      labelNames: ['event_type'],
      registers: [registry],
    });

    this.outboxPendingMessages = new Gauge({
      name: 'outbox_pending_messages',
      help: 'Current number of pending outbox messages',
      registers: [registry],
    });

    this.outboxDeadLetterMessages = new Gauge({
      name: 'outbox_dead_letter_messages',
      help: 'Current number of dead-lettered outbox messages',
      registers: [registry],
    });

    this.outboxOldestPendingAgeSeconds = new Gauge({
      name: 'outbox_oldest_pending_age_seconds',
      help: 'Age in seconds of the oldest pending outbox message',
      registers: [registry],
    });
  }

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
