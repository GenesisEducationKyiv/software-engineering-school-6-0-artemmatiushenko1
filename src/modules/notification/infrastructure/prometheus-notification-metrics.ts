import { Counter, type Registry } from 'prom-client';
import type { NotificationMetrics } from '../application/ports/notification-metrics.js';

export class PrometheusNotificationMetrics implements NotificationMetrics {
  private readonly notificationsSent: Counter;

  constructor(registry: Registry) {
    this.notificationsSent = new Counter({
      name: 'notifications_sent_total',
      help: 'Total number of notifications sent',
      registers: [registry],
    });
  }

  incrementNotificationsSent(): void {
    this.notificationsSent.inc();
  }
}
