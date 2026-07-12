import { describe, it, expect, beforeEach } from 'vitest';
import { mock, mockReset } from 'vitest-mock-extended';
import type { EventBus } from '../event-bus/event-bus.interface.js';
import type { Logger } from '../../shared-kernel/logger.js';
import type { TransactionManager } from '../../shared-kernel/transaction.js';
import type { OutboxMetrics } from '../metrics/outbox-metrics.interface.js';
import { FakeScheduler } from '../scheduler/fake-scheduler.js';
import type { OutboxRepository } from './outbox.repository.js';
import type { OutboxMessage } from './outbox-message.js';
import { OutboxRelay } from './outbox-relay.js';

describe('OutboxRelay', () => {
  const outboxRepository = mock<OutboxRepository>();
  const eventBus = mock<EventBus>();
  const transactionManager = mock<TransactionManager>();
  const logger = mock<Logger>();
  const metrics = mock<OutboxMetrics>();
  const scheduler = new FakeScheduler();
  const cronExpression = '*/3 * * * * *';
  const maxRetries = 3;

  const sampleMessage: OutboxMessage = {
    id: 'msg-1',
    eventType: 'SubscriptionRequested',
    aggregateId: 'sub-1',
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    payload: { email: 'user@example.com', repo: 'owner/repo' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    processedAt: null,
    attemptCount: 0,
    lastError: null,
    deadLetteredAt: null,
  };

  const createRelay = (expression = cronExpression) =>
    new OutboxRelay(
      outboxRepository,
      eventBus,
      transactionManager,
      logger,
      metrics,
      scheduler,
      expression,
      maxRetries,
    );

  const relay = createRelay();

  beforeEach(() => {
    scheduler.scheduledTasks.length = 0;
    scheduler.stopCalls = 0;
    mockReset(outboxRepository);
    mockReset(eventBus);
    mockReset(transactionManager);
    mockReset(logger);
    mockReset(metrics);

    outboxRepository.recordFailure.mockResolvedValue(1);
    outboxRepository.countPending.mockResolvedValue(0);
    outboxRepository.countDeadLetters.mockResolvedValue(0);
    outboxRepository.oldestPendingAgeSeconds.mockResolvedValue(0);
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );
  });

  it('publishes pending messages and marks them processed', async () => {
    outboxRepository.fetchPending.mockResolvedValue([sampleMessage]);

    await relay.runOnce();

    expect(eventBus.publish).toHaveBeenCalledWith([
      {
        type: 'SubscriptionRequested',
        aggregateId: 'sub-1',
        occurredAt: sampleMessage.occurredAt.toISOString(),
        payload: sampleMessage.payload,
        id: 'msg-1',
      },
    ]);
    expect(outboxRepository.markProcessed).toHaveBeenCalledWith(['msg-1']);
    expect(metrics.setOutboxPendingMessages).toHaveBeenCalledWith(0);
  });

  it('does nothing when there are no pending messages', async () => {
    outboxRepository.fetchPending.mockResolvedValue([]);

    await relay.runOnce();

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(outboxRepository.markProcessed).not.toHaveBeenCalled();
  });

  it('records failure and retries below max attempts', async () => {
    outboxRepository.fetchPending.mockResolvedValue([sampleMessage]);
    eventBus.publish.mockRejectedValue(new Error('publish failed'));

    await relay.runOnce();

    expect(outboxRepository.markProcessed).not.toHaveBeenCalled();
    expect(outboxRepository.recordFailure).toHaveBeenCalledWith(
      'msg-1',
      'publish failed',
    );
    expect(outboxRepository.moveToDeadLetter).not.toHaveBeenCalled();
    expect(metrics.incrementOutboxRelayFailures).toHaveBeenCalledWith(
      'SubscriptionRequested',
    );
    expect(metrics.incrementOutboxDeadLetters).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Outbox relay failed',
      expect.any(Error),
      { messageId: 'msg-1', attempts: 1 },
    );
  });

  it('dead-letters a message after max retries', async () => {
    outboxRepository.fetchPending.mockResolvedValue([sampleMessage]);
    outboxRepository.recordFailure.mockResolvedValue(maxRetries);
    eventBus.publish.mockRejectedValue(new Error('publish failed'));

    await relay.runOnce();

    expect(outboxRepository.moveToDeadLetter).toHaveBeenCalledWith(
      'msg-1',
      'publish failed',
    );
    expect(metrics.incrementOutboxDeadLetters).toHaveBeenCalledWith(
      'SubscriptionRequested',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Outbox message dead-lettered',
      expect.any(Error),
      {
        messageId: 'msg-1',
        eventType: 'SubscriptionRequested',
        attempts: maxRetries,
      },
    );
  });

  it('marks each message processed independently in a batch', async () => {
    const secondMessage: OutboxMessage = {
      ...sampleMessage,
      id: 'msg-2',
      aggregateId: 'sub-2',
    };

    outboxRepository.fetchPending.mockResolvedValue([
      sampleMessage,
      secondMessage,
    ]);

    await relay.runOnce();

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(outboxRepository.markProcessed).toHaveBeenNthCalledWith(1, [
      'msg-1',
    ]);
    expect(outboxRepository.markProcessed).toHaveBeenNthCalledWith(2, [
      'msg-2',
    ]);
  });

  it('continues the batch when one message fails', async () => {
    const secondMessage: OutboxMessage = {
      ...sampleMessage,
      id: 'msg-2',
      aggregateId: 'sub-2',
    };

    outboxRepository.fetchPending.mockResolvedValue([
      sampleMessage,
      secondMessage,
    ]);
    eventBus.publish
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('publish failed'));

    await relay.runOnce();

    expect(outboxRepository.markProcessed).toHaveBeenCalledTimes(1);
    expect(outboxRepository.markProcessed).toHaveBeenCalledWith(['msg-1']);
    expect(outboxRepository.recordFailure).toHaveBeenCalledWith(
      'msg-2',
      'publish failed',
    );
  });

  it('start does not schedule when cron expression is empty', () => {
    const idleRelay = createRelay('');

    idleRelay.start();

    expect(scheduler.scheduledTasks).toHaveLength(0);
  });

  it('start schedules a task that runs runOnce', async () => {
    outboxRepository.fetchPending.mockResolvedValue([]);

    relay.start();
    await scheduler.invokeLatest();

    expect(scheduler.scheduledTasks).toHaveLength(1);
    expect(outboxRepository.fetchPending).toHaveBeenCalled();
  });

  it('scheduled tick logs infra failures without throwing', async () => {
    transactionManager.run.mockRejectedValue(new Error('db unavailable'));

    relay.start();
    await scheduler.invokeLatest();

    expect(logger.error).toHaveBeenCalledWith(
      'Scheduled outbox relay failed',
      expect.objectContaining({ message: 'db unavailable' }),
    );
  });

  it('stop awaits in-flight runOnce and blocks new runs', async () => {
    const stoppingRelay = createRelay();
    let resolvePublish!: () => void;
    const publishBlocked = new Promise<void>((resolve) => {
      resolvePublish = resolve;
    });

    outboxRepository.fetchPending.mockResolvedValue([sampleMessage]);
    eventBus.publish.mockReturnValue(publishBlocked);

    stoppingRelay.start();
    const run = stoppingRelay.runOnce();
    const stopped = stoppingRelay.stop();

    resolvePublish();
    await run;
    await stopped;

    expect(scheduler.stopCalls).toBe(1);

    outboxRepository.fetchPending.mockClear();
    await stoppingRelay.runOnce();

    expect(outboxRepository.fetchPending).not.toHaveBeenCalled();
  });
});
