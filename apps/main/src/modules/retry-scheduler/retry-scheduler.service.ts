import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  ChannelType,
  MessageDispatchEntity,
  MessageDispatchStatus,
  MessagePayloadEntity,
  MessageRecipientEntity,
  MessageRequestEntity,
  PayloadEncryptionStatus,
} from '@app/database';
import { KafkaService } from '@app/kafka';
import { MessageSendEvent } from '@app/contracts';
import { PayloadCryptoService } from '@app/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RetrySchedulerService {
  private readonly logger = new Logger(RetrySchedulerService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(MessageDispatchEntity)
    private readonly dispatchRepository: Repository<MessageDispatchEntity>,
    @InjectRepository(MessageRequestEntity)
    private readonly requestRepository: Repository<MessageRequestEntity>,
    @InjectRepository(MessagePayloadEntity)
    private readonly payloadRepository: Repository<MessagePayloadEntity>,
    @InjectRepository(MessageRecipientEntity)
    private readonly recipientRepository: Repository<MessageRecipientEntity>,
    private readonly kafkaService: KafkaService,
    private readonly payloadCryptoService: PayloadCryptoService,
  ) { }

  @Cron(CronExpression.EVERY_MINUTE)
  async retryPendingDispatches(): Promise<void> {
    const dispatches = await this.dispatchRepository.find({
      where: {
        status: MessageDispatchStatus.RETRY_WAIT,
        nextRetryAt: LessThanOrEqual(new Date()),
      },
      take: 100,
    });

    if (dispatches.length === 0) return;

    this.logger.log(`Retrying ${dispatches.length} dispatches`);

    for (const dispatch of dispatches) {
      await this.retryDispatch(dispatch);
    }
  }

  private async retryDispatch(dispatch: MessageDispatchEntity): Promise<void> {
    try {
      const request = await this.requestRepository.findOne({ where: { id: dispatch.messageRequestId } });
      const payload = await this.payloadRepository.findOne({ where: { messageRequestId: dispatch.messageRequestId } });
      const recipient = await this.recipientRepository.findOne({ where: { id: dispatch.recipientId } });

      if (!request || !payload || !recipient) {
        this.logger.warn(`Missing data for dispatch ${dispatch.id}, marking failed`);
        dispatch.status = MessageDispatchStatus.FAILED;
        dispatch.failedAt = new Date();
        await this.dispatchRepository.save(dispatch);
        return;
      }

      const metadata = (request.metadata ?? {}) as Record<string, unknown>;
      const channel = typeof metadata['channel'] === 'string' ? metadata['channel'] : ChannelType.EMAIL;

      const variables =
        payload.encryptionStatus === PayloadEncryptionStatus.ENCRYPTED
          ? this.payloadCryptoService.decrypt(payload.payloadJson)
          : payload.payloadJson;

      const event: MessageSendEvent = {
        messageRequestId: request.id,
        requestId: request.requestId,
        recipientId: recipient.id,
        clientAppId: request.clientAppId,
        templateCode: request.templateCode ?? '',
        channel,
        receiver: {
          userId: recipient.userId,
          receiverName: recipient.receiverName,
          email: recipient.email,
          phoneNumber: recipient.phoneNumber,
          kakaoPhoneNumber: recipient.kakaoPhoneNumber,
        },
        variables,
        priority: request.priority,
        callbackUrl: request.callbackUrl,
        requestedAt: request.requestedAt.toISOString(),
      };

      await this.kafkaService.publishMessageSend(event);

      dispatch.status = MessageDispatchStatus.PROCESSING;
      dispatch.processingAt = new Date();
      dispatch.nextRetryAt = null;
      await this.dispatchRepository.save(dispatch);

      this.logger.log(`Retry published: dispatchId=${dispatch.id}, requestId=${request.requestId}`);
    } catch (error) {
      this.logger.error(`Failed to retry dispatch ${dispatch.id}`, error instanceof Error ? error.stack : error);
    }
  }
}
