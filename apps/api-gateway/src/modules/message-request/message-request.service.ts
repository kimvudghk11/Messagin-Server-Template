import {
  ChannelGroupType,
  MessagePayloadEntity,
  MessagePriority,
  MessageRequestEntity,
  MessageRequestStatus,
  MessageType,
  PayloadEncryptionStatus,
} from '@app/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
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
    private readonly templateService: TemplateService,
    private readonly templateVariableValidator: TemplateVariableValidator,
  ) { }

  async send(auth: AuthenticatedClient, dto: SendMessageRequestDto) {
    const template = await this.templateService.getTemplateByCode(dto.templateCode, auth.clientAppId);
    const templateVariables = await this.templateService.getTemplateVariables(
      dto.templateCode,
      auth.clientAppId,
    );

    this.templateVariableValidator.validate(templateVariables, dto.variables);

    const messageRequest = this.messageRequestRepository.create({
      requestId: dto.requestId || randomUUID(),
      clientAppId: auth.clientAppId,
      templateId: template.id,
      templateCode: template.templateCode,
      messageType: MessageType.TEMPLATE,
      channelGroupType: ChannelGroupType.SINGLE,
      requestedByUserId: null,
      requestedBySystem: auth.appCode,
      priority: dto.priority ?? MessagePriority.NORMAL,
      status: MessageRequestStatus.RECEIVED,
      callbackUrl: dto.callbackUrl ?? null,
      metadata: {
        ...(dto.metadata ?? {}),
        channel: dto.channel,
        receiver: dto.receiver,
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

    return {
      messageRequestId: savedRequest.id,
      requestId: savedRequest.requestId,
      status: savedRequest.status,
      templateCode: savedRequest.templateCode,
      channel: dto.channel,
      createdAt: savedRequest.createdAt,
    };
  }
}
