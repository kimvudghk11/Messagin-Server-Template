import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ChannelType,
  MessageDispatchEntity,
  MessageDispatchStatus,
  MessagePayloadEntity,
  MessageRecipientEntity,
  MessageRequestEntity,
  MessagePriority,
  MessageRequestStatus,
} from '@app/database';
import { KafkaService } from '@app/kafka';
import { RetrySchedulerService } from './retry-scheduler.service';

function makeDispatch(overrides: Partial<MessageDispatchEntity> = {}): MessageDispatchEntity {
  return {
    id: 'dispatch-uuid',
    messageRequestId: 'req-entity-uuid',
    recipientId: 'recipient-uuid',
    channelType: ChannelType.EMAIL,
    status: MessageDispatchStatus.RETRY_WAIT,
    retryCount: 1,
    maxRetryCount: 3,
    nextRetryAt: new Date(Date.now() - 1000),
    processingAt: null,
    ...overrides,
  } as MessageDispatchEntity;
}

function makeRequest(): MessageRequestEntity {
  return {
    id: 'req-entity-uuid',
    requestId: 'req-001',
    clientAppId: 'app-uuid',
    templateCode: 'WELCOME',
    priority: MessagePriority.NORMAL,
    callbackUrl: null,
    metadata: { channel: 'EMAIL' },
    requestedAt: new Date(),
    status: MessageRequestStatus.PROCESSING,
  } as unknown as MessageRequestEntity;
}

function makePayload(): MessagePayloadEntity {
  return {
    id: 'payload-uuid',
    payloadJson: { name: 'Alice' },
  } as unknown as MessagePayloadEntity;
}

function makeRecipient(): MessageRecipientEntity {
  return {
    id: 'recipient-uuid',
    email: 'alice@example.com',
    userId: null,
    receiverName: null,
    phoneNumber: null,
    kakaoPhoneNumber: null,
  } as MessageRecipientEntity;
}

describe('RetrySchedulerService', () => {
  let service: RetrySchedulerService;
  let dispatchRepo: { find: jest.Mock; save: jest.Mock };
  let requestRepo: { findOne: jest.Mock };
  let payloadRepo: { findOne: jest.Mock };
  let recipientRepo: { findOne: jest.Mock };
  let kafkaService: { publishMessageSend: jest.Mock };

  beforeEach(async () => {
    dispatchRepo = { find: jest.fn(), save: jest.fn() };
    requestRepo = { findOne: jest.fn() };
    payloadRepo = { findOne: jest.fn() };
    recipientRepo = { findOne: jest.fn() };
    kafkaService = { publishMessageSend: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrySchedulerService,
        { provide: getRepositoryToken(MessageDispatchEntity), useValue: dispatchRepo },
        { provide: getRepositoryToken(MessageRequestEntity), useValue: requestRepo },
        { provide: getRepositoryToken(MessagePayloadEntity), useValue: payloadRepo },
        { provide: getRepositoryToken(MessageRecipientEntity), useValue: recipientRepo },
        { provide: KafkaService, useValue: kafkaService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('message.send') } },
      ],
    }).compile();

    service = module.get(RetrySchedulerService);
  });

  it('does nothing when no retryable dispatches', async () => {
    dispatchRepo.find.mockResolvedValue([]);

    await service.retryPendingDispatches();

    expect(kafkaService.publishMessageSend).not.toHaveBeenCalled();
  });

  it('re-publishes dispatch to Kafka and sets status to PROCESSING', async () => {
    dispatchRepo.find.mockResolvedValue([makeDispatch()]);
    requestRepo.findOne.mockResolvedValue(makeRequest());
    payloadRepo.findOne.mockResolvedValue(makePayload());
    recipientRepo.findOne.mockResolvedValue(makeRecipient());
    kafkaService.publishMessageSend.mockResolvedValue(undefined);
    dispatchRepo.save.mockResolvedValue({});

    await service.retryPendingDispatches();

    expect(kafkaService.publishMessageSend).toHaveBeenCalledTimes(1);
    expect(dispatchRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: MessageDispatchStatus.PROCESSING, nextRetryAt: null }),
    );
  });

  it('marks dispatch FAILED when request data is missing', async () => {
    dispatchRepo.find.mockResolvedValue([makeDispatch()]);
    requestRepo.findOne.mockResolvedValue(null);
    payloadRepo.findOne.mockResolvedValue(null);
    recipientRepo.findOne.mockResolvedValue(null);
    dispatchRepo.save.mockResolvedValue({});

    await service.retryPendingDispatches();

    expect(kafkaService.publishMessageSend).not.toHaveBeenCalled();
    expect(dispatchRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: MessageDispatchStatus.FAILED }),
    );
  });
});
