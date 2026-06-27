import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { NotificationService } from '../../api/notification.service.js';
import { ScannerEventType } from '../../../scanner/api/events.js';
import { NewReleaseDetectedSubscriber } from './new-release-detected.subscriber.js';

describe('NewReleaseDetectedSubscriber', () => {
  it('sends a new release notification email', async () => {
    const notificationService = mock<NotificationService>();
    const subscriber = new NewReleaseDetectedSubscriber(notificationService);

    await subscriber.handle({
      type: ScannerEventType.NewReleaseDetected,
      aggregateId: 'sub-1',
      occurredAt: new Date('2024-01-01T00:00:00.000Z'),
      payload: {
        email: 'test@example.com',
        repo: 'owner/repo',
        tag: 'v1.1.0',
        releaseName: 'Release 1.1',
        unsubscribeToken: 'unsub-token',
      },
    });

    expect(notificationService.notifyNewRelease).toHaveBeenCalledWith({
      email: 'test@example.com',
      repo: 'owner/repo',
      tag: 'v1.1.0',
      releaseName: 'Release 1.1',
      unsubscribeToken: 'unsub-token',
    });
  });
});
