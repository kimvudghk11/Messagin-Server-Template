import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InternalServerErrorException } from '@nestjs/common';
import {
  ChannelType,
  MessagePayloadEntity,
  MessagePriority,
  MessageRecipientEntity,
  MessageRequestEntity,
  MessageRequestStatus,
  PayloadEncryptionStatus,
  RecipientStatus,
} from '@app/database';
import { KafkaService } from '@app/kafka';
import { MessageRequestService } from './message-request.service';
import { TemplateService } from '../template/template.service';
import { TemplateVariableValidator } from './validator/template-variable.validator';
import { AuthenticatedClient } from '../auth/client-auth.service';
import { SendMessageRequestDto } from './dto/send-message-request.dto';
import { TemplateCategory, TemplateAccessScope } from '@app/database';

const auth: AuthenticatedClient = {
  clientAppId: 'app-uuid',
  appCode: 'my-app',
  apiKeyId: 'key-uuid',
};

const dto: SendMessageRequestDto = {
  requestId: 'req-001',
  templateCode: 'WELCOME',
  channel: ChannelType.EMAIL,
  receiver: { email: 'user@example.com' },
  variables: { name: 'Alice' },
  priority: MessagePriority.NORMAL,
};

function makeSavedRequest(overrides: Partial<MessageRequestEntity> = {}): MessageRequestEntity {
  return {
    id: 'req-entity-uuid',
    requestId: 'req-001',
    clientAppId: 'app-uuid',
    templateId: 'tpl-uuid',
    templateCode: 'WELCOME',
    status: MessageRequestStatus.VALIDATED,
    priority: MessagePriority.NORMAL,
    callbackUrl: null,
    metadata: { channel: 'EMAIL', receiver: { email: 'user@example.com' } },
    requestedAt: new Date(),
    queuedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as MessageRequestEntity;
}

function makeSavedRecipient(): MessageRecipientEntity {
  return {
    id: 'recipient-uuid',
    messageRequestId: 'req-entity-uuid',
    status: RecipientStatus.READY,
    email: 'user@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as MessageRecipientEntity;
}

describe('MessageRequestService', () => {
  let service: MessageRequestService;
  let requestRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let payloadRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let recipientRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let templateService: { getTemplateByCode: jest.Mock; getVariablesByTemplateId: jest.Mock };
  let variableValidator: { validate: jest.Mock };
  let kafkaService: { publishMessageSend: jest.Mock };

  beforeEach(async () => {
    requestRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    payloadRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    recipientRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    templateService = { getTemplateByCode: jest.fn(), getVariablesByTemplateId: jest.fn() };
    variableValidator = { validate: jest.fn() };
    kafkaService = { publishMessageSend: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageRequestService,
        { provide: getRepositoryToken(MessageRequestEntity), useValue: requestRepo },
        { provide: getRepositoryToken(MessagePayloadEntity), useValue: payloadRepo },
        { provide: getRepositoryToken(MessageRecipientEntity), useValue: recipientRepo },
        { provide: TemplateService, useValue: templateService },
        { provide: TemplateVariableValidator, useValue: variableValidator },
        { provide: KafkaService, useValue: kafkaService },
      ],
    }).compile();

    service = module.get(MessageRequestService);
  });

  describe('new request flow', () => {
    beforeEach(() => {
      const template = {
        id: 'tpl-uuid',
        templateCode: 'WELCOME',
        category: TemplateCategory.SYSTEM,
        accessScope: TemplateAccessScope.PUBLIC,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const savedRequest = makeSavedRequest();
      const queuedRequest = makeSavedRequest({ status: MessageRequestStatus.QUEUED, queuedAt: new Date() });
      const savedPayload = { id: 'payload-uuid' } as MessagePayloadEntity;
      const savedRecipient = makeSavedRecipient();

      requestRepo.findOne.mockResolvedValue(null);
      templateService.getTemplateByCode.mockResolvedValue(template);
      templateService.getVariablesByTemplateId.mockResolvedValue([]);
      requestRepo.create.mockReturnValue(savedRequest);
      requestRepo.save
        .mockResolvedValueOnce(savedRequest)
        .mockResolvedValueOnce(queuedRequest);
      payloadRepo.create.mockReturnValue(savedPayload);
      payloadRepo.save.mockResolvedValue(savedPayload);
      recipientRepo.create.mockReturnValue(savedRecipient);
      recipientRepo.save.mockResolvedValue(savedRecipient);
      kafkaService.publishMessageSend.mockResolvedValue(undefined);
    });

    it('publishes to Kafka and returns QUEUED status', async () => {
      const result = await service.send(auth, dto);

      expect(kafkaService.publishMessageSend).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(MessageRequestStatus.QUEUED);
      expect(result.requestId).toBe('req-001');
    });

    it('saves payload with correct fields', async () => {
      await service.send(auth, dto);

      expect(payloadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadJson: dto.variables,
          encryptionStatus: PayloadEncryptionStatus.PLAIN,
        }),
      );
    });

    it('saves recipient with channel-specific fields', async () => {
      await service.send(auth, dto);

      expect(recipientRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com' }),
      );
    });

    it('throws InternalServerErrorException when Kafka publish fails', async () => {
      kafkaService.publishMessageSend.mockRejectedValue(new Error('Kafka down'));

      await expect(service.send(auth, dto)).rejects.toThrow(InternalServerErrorException);
    });

    it('does not call second requestRepo.save (QUEUED update) when Kafka fails', async () => {
      kafkaService.publishMessageSend.mockRejectedValue(new Error('Kafka down'));

      await expect(service.send(auth, dto)).rejects.toThrow();
      // Only initial save of messageRequest, never the QUEUED status update
      expect(requestRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('idempotent retry — QUEUED status', () => {
    it('returns existing response without re-publishing when already QUEUED', async () => {
      const queuedRequest = makeSavedRequest({
        status: MessageRequestStatus.QUEUED,
        queuedAt: new Date(),
      });
      requestRepo.findOne.mockResolvedValue(queuedRequest);

      const result = await service.send(auth, dto);

      expect(kafkaService.publishMessageSend).not.toHaveBeenCalled();
      expect(result.status).toBe(MessageRequestStatus.QUEUED);
    });
  });

  describe('idempotent retry — VALIDATED status (Kafka previously failed)', () => {
    it('re-publishes and returns QUEUED when status is VALIDATED', async () => {
      const validatedRequest = makeSavedRequest({ status: MessageRequestStatus.VALIDATED });
      const queuedRequest = makeSavedRequest({ status: MessageRequestStatus.QUEUED, queuedAt: new Date() });
      const savedPayload = { id: 'payload-uuid', payloadJson: { name: 'Alice' } } as unknown as MessagePayloadEntity;
      const savedRecipient = makeSavedRecipient();

      requestRepo.findOne.mockResolvedValue(validatedRequest);
      payloadRepo.findOne.mockResolvedValue(savedPayload);
      recipientRepo.findOne.mockResolvedValue(savedRecipient);
      kafkaService.publishMessageSend.mockResolvedValue(undefined);
      requestRepo.save.mockResolvedValue(queuedRequest);

      const result = await service.send(auth, dto);

      expect(kafkaService.publishMessageSend).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(MessageRequestStatus.QUEUED);
    });

    it('throws when payload is missing during retry', async () => {
      const validatedRequest = makeSavedRequest({ status: MessageRequestStatus.VALIDATED });

      requestRepo.findOne.mockResolvedValue(validatedRequest);
      payloadRepo.findOne.mockResolvedValue(null);

      await expect(service.send(auth, dto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('idempotent retry — terminal statuses', () => {
    it.each([
      MessageRequestStatus.COMPLETED,
      MessageRequestStatus.FAILED,
      MessageRequestStatus.PROCESSING,
      MessageRequestStatus.CANCELED,
    ])('returns current state without re-publishing for %s status', async (status) => {
      const existingRequest = makeSavedRequest({ status });
      requestRepo.findOne.mockResolvedValue(existingRequest);

      const result = await service.send(auth, dto);

      expect(kafkaService.publishMessageSend).not.toHaveBeenCalled();
      expect(result.status).toBe(status);
    });
  });
});
