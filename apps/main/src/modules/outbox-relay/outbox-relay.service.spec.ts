import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { MessageOutboxEntity, OutboxEventType, OutboxStatus } from '@app/database';
import { KafkaService } from '@app/kafka';
import { OutboxRelayService } from './outbox-relay.service';

function makeOutboxEntry(overrides: Partial<MessageOutboxEntity> = {}): MessageOutboxEntity {
  return {
    id: 'outbox-uuid',
    aggregateType: 'MESSAGE_REQUEST' as any,
    aggregateId: 'req-uuid',
    eventType: OutboxEventType.MESSAGE_REQUEST_CREATED,
    eventKey: 'req-001',
    payload: { requestId: 'req-001', channel: 'EMAIL' } as any,
    status: OutboxStatus.PENDING,
    publishedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as MessageOutboxEntity;
}

describe('OutboxRelayService', () => {
  let service: OutboxRelayService;
  let outboxRepo: { find: jest.Mock; save: jest.Mock };
  let kafkaService: { publishMessageSend: jest.Mock; publish: jest.Mock };

  beforeEach(async () => {
    outboxRepo = { find: jest.fn(), save: jest.fn() };
    kafkaService = { publishMessageSend: jest.fn(), publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRelayService,
        { provide: getRepositoryToken(MessageOutboxEntity), useValue: outboxRepo },
        { provide: KafkaService, useValue: kafkaService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('message.send') } },
      ],
    }).compile();

    service = module.get(OutboxRelayService);
  });

  it('does nothing when no pending events', async () => {
    outboxRepo.find.mockResolvedValue([]);

    await service.relayPendingEvents();

    expect(kafkaService.publishMessageSend).not.toHaveBeenCalled();
  });

  it('publishes MESSAGE_REQUEST_CREATED events and marks PUBLISHED', async () => {
    const entry = makeOutboxEntry();
    outboxRepo.find.mockResolvedValue([entry]);
    kafkaService.publishMessageSend.mockResolvedValue(undefined);
    outboxRepo.save.mockResolvedValue({});

    await service.relayPendingEvents();

    expect(kafkaService.publishMessageSend).toHaveBeenCalledTimes(1);
    expect(outboxRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OutboxStatus.PUBLISHED, publishedAt: expect.any(Date) }),
    );
  });

  it('marks FAILED when Kafka publish throws', async () => {
    const entry = makeOutboxEntry();
    outboxRepo.find.mockResolvedValue([entry]);
    kafkaService.publishMessageSend.mockRejectedValue(new Error('Kafka down'));
    outboxRepo.save.mockResolvedValue({});

    await service.relayPendingEvents();

    expect(outboxRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OutboxStatus.FAILED, errorMessage: 'Kafka down' }),
    );
  });

  it('relays multiple pending events independently', async () => {
    const entries = [makeOutboxEntry({ id: 'e1', eventKey: 'r1' }), makeOutboxEntry({ id: 'e2', eventKey: 'r2' })];
    outboxRepo.find.mockResolvedValue(entries);
    kafkaService.publishMessageSend.mockResolvedValue(undefined);
    outboxRepo.save.mockResolvedValue({});

    await service.relayPendingEvents();

    expect(kafkaService.publishMessageSend).toHaveBeenCalledTimes(2);
    expect(outboxRepo.save).toHaveBeenCalledTimes(2);
  });
});
