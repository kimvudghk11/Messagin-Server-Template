import {
  ChannelGroupType,
  MessageOutboxEntity,
  MessagePayloadEntity,
  MessagePriority,
  MessageRecipientEntity,
  MessageRequestEntity,
  MessageRequestStatus,
  MessageType,
  OutboxAggregateType,
  OutboxEventType,
  OutboxStatus,
  PayloadEncryptionStatus,
  RecipientStatus,
  RecipientType,
} from '@app/database';
import { MessageSendEvent } from '@app/contracts';
import { KafkaService } from '@app/kafka';
import { AppException, ErrorCode, PayloadCryptoService } from '@app/common';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthenticatedClient } from '../auth/client-auth.service';
import { TemplateService } from '../template/template.service';
import { SendMessageRequestDto } from './dto/send-message-request.dto';
import { TemplateVariableValidator } from './validator/template-variable.validator';

@Injectable()
export class MessageRequestService {
  constructor(
    @InjectRepository(MessageRequestEntity)
    private readonly messageRequestRepository: Repository<MessageRequestEntity>,
    @InjectRepository(MessagePayloadEntity)
    private readonly messagePayloadRepository: Repository<MessagePayloadEntity>,
    @InjectRepository(MessageRecipientEntity)
    private readonly messageRecipientRepository: Repository<MessageRecipientEntity>,
    @InjectRepository(MessageOutboxEntity)
    private readonly messageOutboxRepository: Repository<MessageOutboxEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly templateService: TemplateService,
    private readonly templateVariableValidator: TemplateVariableValidator,
    private readonly kafkaService: KafkaService,
    private readonly payloadCryptoService: PayloadCryptoService,
  ) { }

  async send(auth: AuthenticatedClient, dto: SendMessageRequestDto) {
    const existingRequest = await this.messageRequestRepository.findOne({
      where: { requestId: dto.requestId },
    });

    if (existingRequest) {
      return this.handleExistingRequest(existingRequest);
    }

    const template = await this.templateService.getTemplateByCode(dto.templateCode, auth.clientAppId);
    const templateVariables = await this.templateService.getVariablesByTemplateId(template.id);

    this.templateVariableValidator.validate(templateVariables, dto.variables);

    const { savedRequest, savedRecipient, event, outboxEntry } =
      await this.dataSource.transaction(async (manager: EntityManager) => {
        const req = manager.create(MessageRequestEntity, {
          requestId: dto.requestId,
          clientAppId: auth.clientAppId,
          templateId: template.id,
          templateCode: template.templateCode,
          messageType: MessageType.TEMPLATE,
          channelGroupType: ChannelGroupType.SINGLE,
          requestedByUserId: null,
          requestedBySystem: auth.appCode,
          priority: dto.priority ?? MessagePriority.NORMAL,
          status: MessageRequestStatus.VALIDATED,
          callbackUrl: dto.callbackUrl ?? null,
          metadata: {
            ...(dto.metadata ?? {}),
            channel: dto.channel,
            receiver: this.receiverToRecord(dto.receiver),
          },
          requestedAt: new Date(),
          validatedAt: new Date(),
          queuedAt: null,
          completedAt: null,
          canceledAt: null,
        });
        const savedRequest = await manager.save(req);

        const maskedPayload = this.payloadCryptoService.mask(dto.variables);
        const encryptedPayload = this.payloadCryptoService.encrypt(dto.variables);

        const payloadEntity = manager.create(MessagePayloadEntity, {
          messageRequestId: savedRequest.id,
          payloadJson: encryptedPayload,
          maskedPayloadJson: maskedPayload,
          encryptionStatus: PayloadEncryptionStatus.ENCRYPTED,
        });
        await manager.save(payloadEntity);

        const recipientEntity = manager.create(MessageRecipientEntity, {
          messageRequestId: savedRequest.id,
          recipientType: RecipientType.TO,
          userId: dto.receiver.userId ?? null,
          receiverName: dto.receiver.receiverName ?? null,
          email: dto.receiver.email ?? null,
          phoneNumber: dto.receiver.phoneNumber ?? null,
          kakaoPhoneNumber: dto.receiver.kakaoPhoneNumber ?? null,
          status: RecipientStatus.READY,
        });
        const savedRecipient = await manager.save(recipientEntity);

        const event: MessageSendEvent = {
          messageRequestId: savedRequest.id,
          requestId: savedRequest.requestId,
          recipientId: savedRecipient.id,
          clientAppId: savedRequest.clientAppId,
          templateCode: savedRequest.templateCode ?? dto.templateCode,
          channel: dto.channel,
          receiver: this.receiverToRecord(dto.receiver),
          variables: encryptedPayload,
          priority: savedRequest.priority,
          callbackUrl: savedRequest.callbackUrl,
          requestedAt: savedRequest.requestedAt.toISOString(),
        };

        const outboxEntry = manager.create(MessageOutboxEntity, {
          aggregateType: OutboxAggregateType.MESSAGE_REQUEST,
          aggregateId: savedRequest.id,
          eventType: OutboxEventType.MESSAGE_REQUEST_CREATED,
          eventKey: savedRequest.requestId,
          payload: event,
          status: OutboxStatus.PENDING,
          publishedAt: null,
          errorMessage: null,
        });
        await manager.save(outboxEntry);

        return { savedRequest, savedRecipient, event, outboxEntry };
      });

    try {
      await this.kafkaService.publishMessageSend(event);
      outboxEntry.status = OutboxStatus.PUBLISHED;
      outboxEntry.publishedAt = new Date();
      await this.messageOutboxRepository.save(outboxEntry);
    } catch {
      // Outbox relay will pick this up and retry
      throw new AppException(ErrorCode.MSG_KAFKA_PUBLISH_FAILED, 503);
    }

    savedRequest.status = MessageRequestStatus.QUEUED;
    savedRequest.queuedAt = new Date();
    const queuedRequest = await this.messageRequestRepository.save(savedRequest);

    return this.toResponse(queuedRequest, dto.channel);
  }

  private toResponse(messageRequest: MessageRequestEntity, channel?: string) {
    const metadata = this.asRecord(messageRequest.metadata);
    const metadataChannel = this.readString(metadata, 'channel');

    return {
      messageRequestId: messageRequest.id,
      requestId: messageRequest.requestId,
      status: messageRequest.status,
      templateCode: messageRequest.templateCode,
      channel: channel ?? metadataChannel,
      createdAt: messageRequest.createdAt,
      queuedAt: messageRequest.queuedAt,
    };
  }

  private async handleExistingRequest(existingRequest: MessageRequestEntity) {
    // Only VALIDATED means "DB saved but Kafka failed" — safe to re-publish.
    if (existingRequest.status !== MessageRequestStatus.VALIDATED) {
      return this.toResponse(existingRequest);
    }

    const payload = await this.messagePayloadRepository.findOne({
      where: { messageRequestId: existingRequest.id },
    });

    if (!payload) {
      throw new AppException(ErrorCode.MSG_PAYLOAD_NOT_FOUND, 500);
    }

    const metadata = this.asRecord(existingRequest.metadata);
    const channel = this.readString(metadata, 'channel');
    const receiver = this.readRecord(metadata, 'receiver');
    const recipient = await this.messageRecipientRepository.findOne({
      where: { messageRequestId: existingRequest.id },
      order: { createdAt: 'ASC' },
    });

    if (!channel || !receiver || !recipient) {
      throw new AppException(ErrorCode.MSG_REQUEST_DATA_MISSING, 500);
    }

    const event: MessageSendEvent = {
      messageRequestId: existingRequest.id,
      requestId: existingRequest.requestId,
      recipientId: recipient.id,
      clientAppId: existingRequest.clientAppId,
      templateCode: existingRequest.templateCode ?? '',
      channel,
      receiver,
      variables: payload.encryptionStatus === PayloadEncryptionStatus.ENCRYPTED
        ? this.payloadCryptoService.decrypt(payload.payloadJson)
        : payload.payloadJson,
      priority: existingRequest.priority,
      callbackUrl: existingRequest.callbackUrl,
      requestedAt: existingRequest.requestedAt.toISOString(),
    };

    try {
      await this.kafkaService.publishMessageSend(event);
    } catch {
      throw new AppException(ErrorCode.MSG_KAFKA_PUBLISH_FAILED, 503);
    }

    existingRequest.status = MessageRequestStatus.QUEUED;
    existingRequest.queuedAt = new Date();
    const queuedRequest = await this.messageRequestRepository.save(existingRequest);

    return this.toResponse(queuedRequest, channel);
  }

  private asRecord(value: Record<string, unknown> | null): Record<string, unknown> {
    return value ?? {};
  }

  private readString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === 'string' ? value : undefined;
  }

  private readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
    const value = record[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return undefined;
  }

  private receiverToRecord(receiver: SendMessageRequestDto['receiver']): Record<string, unknown> {
    return {
      userId: receiver.userId,
      receiverName: receiver.receiverName,
      email: receiver.email,
      phoneNumber: receiver.phoneNumber,
      kakaoPhoneNumber: receiver.kakaoPhoneNumber,
    };
  }
}
