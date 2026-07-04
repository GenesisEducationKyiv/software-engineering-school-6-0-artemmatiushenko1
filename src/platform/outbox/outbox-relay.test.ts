import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { EventBus } from '../event-bus/event-bus.interface.js';
import type { Logger } from '../../shared-kernel/logger.js';
import type { TransactionManager } from '../../shared-kernel/transaction.js';
import type { OutboxRepository } from './outbox.repository.js';
import type { OutboxMessage } from './outbox-message.js';
import { OutboxRelay } from './outbox-relay.js';

describe('OutboxRelay', () => {
  const outboxRepository = mock<OutboxRepository>();
  const eventBus = mock<EventBus>();
  const transactionManager = mock<TransactionManager>();
  const logger = mock<Logger>();

  const sampleMessage: OutboxMessage = {
    id: 'msg-1',
    eventType: 'SubscriptionRequested',
    aggregateId: 'sub-1',
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    payload: { email: 'user@example.com', repo: 'owner/repo' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    processedAt: null,
  };

  const relay = new OutboxRelay(
    outboxRepository,
    eventBus,
    transactionManager,
    logger,
  );

  beforeEach(() => {
    outboxRepository.fetchPending.mockReset();
    outboxRepository.markProcessed.mockReset();
    eventBus.publish.mockReset();
    transactionManager.run.mockReset();
    logger.error.mockReset();
  });

  it('publishes pending messages and marks them processed', async () => {
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );
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
  });

  it('does nothing when there are no pending messages', async () => {
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );
    outboxRepository.fetchPending.mockResolvedValue([]);

    await relay.runOnce();

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(outboxRepository.markProcessed).not.toHaveBeenCalled();
  });

  it('leaves messages unprocessed when publish fails', async () => {
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );
    outboxRepository.fetchPending.mockResolvedValue([sampleMessage]);
    eventBus.publish.mockRejectedValue(new Error('publish failed'));

    await relay.runOnce();

    expect(outboxRepository.markProcessed).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Outbox relay failed',
      expect.any(Error),
      { messageId: 'msg-1' },
    );
  });

  it('marks each message processed independently in a batch', async () => {
    const secondMessage: OutboxMessage = {
      ...sampleMessage,
      id: 'msg-2',
      aggregateId: 'sub-2',
    };

    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );
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

    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );
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
    expect(logger.error).toHaveBeenCalledWith(
      'Outbox relay failed',
      expect.any(Error),
      { messageId: 'msg-2' },
    );
  });
});
