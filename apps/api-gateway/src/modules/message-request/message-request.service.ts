import {
  ChannelGroupType,
  MessagePayloadEntity,
  MessagePriority,
  MessageRecipientEntity,
  MessageRequestEntity,
  MessageRequestStatus,
  MessageType,
  PayloadEncryptionStatus,
  RecipientStatus,
  RecipientType,
} from '@app/database';
import { MessageSendEvent } from '@app/contracts';
import { KafkaService } from '@app/kafka';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    private readonly templateService: TemplateService,
    private readonly templateVariableValidator: TemplateVariableValidator,
    private readonly kafkaService: KafkaService,
  ) { }

  async send(auth: AuthenticatedClient, dto: SendMessageRequestDto) {
    const existingRequest = await this.messageRequestRepository.findOne({
      where: { requestId: dto.requestId },
    });

    if (existingRequest) {
      return this.handleExistingRequest(existingRequest);
    }

    const template = await this.templateService.getTemplateByCode(dto.templateCode, auth.clientAppId);
    const templateVariables = await this.templateService.getTemplateVariables(
      dto.templateCode,
      auth.clientAppId,
    );

    this.templateVariableValidator.validate(templateVariables, dto.variables);

    const messageRequest = this.messageRequestRepository.create({
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

    const savedRequest = await this.messageRequestRepository.save(messageRequest);

    const payload = this.messagePayloadRepository.create({
      messageRequestId: savedRequest.id,
      payloadJson: dto.variables,
      maskedPayloadJson: null,
      encryptionStatus: PayloadEncryptionStatus.PLAIN,
    });

    await this.messagePayloadRepository.save(payload);

    const recipient = this.messageRecipientRepository.create({
      messageRequestId: savedRequest.id,
      recipientType: RecipientType.TO,
      userId: dto.receiver.userId ?? null,
      receiverName: dto.receiver.receiverName ?? null,
      email: dto.receiver.email ?? null,
      phoneNumber: dto.receiver.phoneNumber ?? null,
      kakaoPhoneNumber: dto.receiver.kakaoPhoneNumber ?? null,
      status: RecipientStatus.READY,
    });

    const savedRecipient = await this.messageRecipientRepository.save(recipient);

    const event: MessageSendEvent = {
      messageRequestId: savedRequest.id,
      requestId: savedRequest.requestId,
      recipientId: savedRecipient.id,
      clientAppId: savedRequest.clientAppId,
      templateCode: savedRequest.templateCode ?? dto.templateCode,
      channel: dto.channel,
      receiver: this.receiverToRecord(dto.receiver),
      variables: dto.variables,
      priority: savedRequest.priority,
      callbackUrl: savedRequest.callbackUrl,
      requestedAt: savedRequest.requestedAt.toISOString(),
    };

    try {
      await this.kafkaService.publishMessageSend(event);
    } catch {
      throw new InternalServerErrorException(
        '메시지 요청 저장은 완료되었지만 Kafka 발행에 실패했습니다. 같은 requestId로 재시도하세요.',
      );
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
    if (existingRequest.status === MessageRequestStatus.QUEUED) {
      return this.toResponse(existingRequest);
    }

    const payload = await this.messagePayloadRepository.findOne({
      where: { messageRequestId: existingRequest.id },
    });

    if (!payload) {
      throw new InternalServerErrorException('기존 요청의 payload를 찾을 수 없습니다.');
    }

    const metadata = this.asRecord(existingRequest.metadata);
    const channel = this.readString(metadata, 'channel');
    const receiver = this.readRecord(metadata, 'receiver');
    const recipient = await this.messageRecipientRepository.findOne({
      where: { messageRequestId: existingRequest.id },
      order: { createdAt: 'ASC' },
    });

    if (!channel || !receiver || !recipient) {
      throw new InternalServerErrorException('기존 요청의 channel/receiver/recipient 정보가 올바르지 않습니다.');
    }

    const event: MessageSendEvent = {
      messageRequestId: existingRequest.id,
      requestId: existingRequest.requestId,
      recipientId: recipient.id,
      clientAppId: existingRequest.clientAppId,
      templateCode: existingRequest.templateCode ?? '',
      channel,
      receiver,
      variables: payload.payloadJson,
      priority: existingRequest.priority,
      callbackUrl: existingRequest.callbackUrl,
      requestedAt: existingRequest.requestedAt.toISOString(),
    };

    await this.kafkaService.publishMessageSend(event);

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
