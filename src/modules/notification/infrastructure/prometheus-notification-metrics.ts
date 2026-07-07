import { Counter } from 'prom-client';
import type { NotificationMetrics } from '../application/ports/notification-metrics.js';

export class PrometheusNotificationMetrics implements NotificationMetrics {
  private readonly notificationsSent = new Counter({
    name: 'notifications_sent_total',
    help: 'Total number of notifications sent',
  });

  incrementNotificationsSent(): void {
    this.notificationsSent.inc();
  }
}
