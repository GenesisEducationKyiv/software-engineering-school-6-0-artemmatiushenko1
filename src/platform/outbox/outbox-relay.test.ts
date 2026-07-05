import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { EventBus } from '../event-bus/event-bus.interface.js';
import type { Logger } from '../../shared-kernel/logger.js';
import type { TransactionManager } from '../../shared-kernel/transaction.js';
import type { OutboxMetrics } from '../metrics/outbox-metrics.interface.js';
import type { OutboxRepository } from './outbox.repository.js';
import type { OutboxMessage } from './outbox-message.js';
import { OutboxRelay } from './outbox-relay.js';

describe('OutboxRelay', () => {
  const outboxRepository = mock<OutboxRepository>();
  const eventBus = mock<EventBus>();
  const transactionManager = mock<TransactionManager>();
  const logger = mock<Logger>();
  const metrics = mock<OutboxMetrics>();
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

  const relay = new OutboxRelay(
    outboxRepository,
    eventBus,
    transactionManager,
    logger,
    metrics,
    maxRetries,
  );

  beforeEach(() => {
    outboxRepository.fetchPending.mockReset();
    outboxRepository.markProcessed.mockReset();
    outboxRepository.recordFailure.mockReset();
    outboxRepository.moveToDeadLetter.mockReset();
    outboxRepository.countPending.mockReset();
    outboxRepository.countDeadLetters.mockReset();
    outboxRepository.oldestPendingAgeSeconds.mockReset();
    eventBus.publish.mockReset();
    transactionManager.run.mockReset();
    logger.error.mockReset();
    metrics.incrementOutboxRelayFailures.mockReset();
    metrics.incrementOutboxDeadLetters.mockReset();
    metrics.setOutboxPendingMessages.mockReset();
    metrics.setOutboxDeadLetterMessages.mockReset();
    metrics.setOutboxOldestPendingAgeSeconds.mockReset();

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
});
