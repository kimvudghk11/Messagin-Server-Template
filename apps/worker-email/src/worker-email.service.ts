import {
  ChannelType,
  DispatchLogStatus,
  DispatchLogType,
  MessageDispatchEntity,
  MessageDispatchLogEntity,
  MessageDispatchStatus,
  MessageRequestEntity,
  MessageRequestStatus,
  ProviderType,
} from '@app/database';
import { MessageSendEvent } from '@app/contracts';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Consumer, Kafka } from 'kafkajs';
import { Repository } from 'typeorm';

@Injectable()
export class WorkerEmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerEmailService.name);
  private readonly consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(MessageRequestEntity)
    private readonly messageRequestRepository: Repository<MessageRequestEntity>,
    @InjectRepository(MessageDispatchEntity)
    private readonly messageDispatchRepository: Repository<MessageDispatchEntity>,
    @InjectRepository(MessageDispatchLogEntity)
    private readonly messageDispatchLogRepository: Repository<MessageDispatchLogEntity>,
  ) {
    const brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const kafka = new Kafka({
      clientId: this.configService.get<string>('KAFKA_WORKER_EMAIL_CLIENT_ID', 'worker-email'),
      brokers,
    });

    this.consumer = kafka.consumer({
      groupId: this.configService.get<string>('KAFKA_WORKER_EMAIL_GROUP_ID', 'worker-email-group'),
    });
  }

  async onModuleInit(): Promise<void> {
    const topic = this.configService.get<string>('KAFKA_TOPIC_MESSAGE_SEND', 'message.send');

    await this.consumer.connect();
    await this.consumer.subscribe({ topic, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) {
          return;
        }

        const raw = message.value.toString();
        const event = JSON.parse(raw) as MessageSendEvent;

        if (event.channel !== ChannelType.EMAIL) {
          return;
        }

        await this.process(event);
      },
    });

    this.logger.log(`worker-email consumer started: topic=${topic}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }

  private async process(event: MessageSendEvent): Promise<void> {
    const messageRequest = await this.messageRequestRepository.findOne({
      where: { id: event.messageRequestId },
    });

    if (!messageRequest) {
      this.logger.warn(`message_request not found: ${event.messageRequestId}`);
      return;
    }

    const existingSuccessDispatch = await this.messageDispatchRepository.findOne({
      where: {
        messageRequestId: event.messageRequestId,
        recipientId: event.recipientId,
        channelType: ChannelType.EMAIL,
        status: MessageDispatchStatus.SUCCESS,
      },
      order: { createdAt: 'DESC' },
    });

    if (existingSuccessDispatch) {
      this.logger.log(`dispatch already succeeded, skip: requestId=${event.requestId}`);
      return;
    }

    const dispatch = this.messageDispatchRepository.create({
      messageRequestId: event.messageRequestId,
      recipientId: event.recipientId,
      templateChannelId: null,
      channelType: ChannelType.EMAIL,
      providerType: ProviderType.AWS_SES,
      status: MessageDispatchStatus.PROCESSING,
      retryCount: 0,
      maxRetryCount: 3,
      nextRetryAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      providerMessageId: null,
      queuedAt: new Date(),
      processingAt: new Date(),
      sentAt: null,
      deliveredAt: null,
      successAt: null,
      failedAt: null,
    });

    const savedDispatch = await this.messageDispatchRepository.save(dispatch);

    await this.writeLog(savedDispatch.id, DispatchLogType.REQUEST, DispatchLogStatus.PROCESSING, {
      event,
    });

    try {
      const providerMessageId = `email_${randomUUID()}`;

      savedDispatch.status = MessageDispatchStatus.SUCCESS;
      savedDispatch.providerMessageId = providerMessageId;
      savedDispatch.sentAt = new Date();
      savedDispatch.successAt = new Date();
      await this.messageDispatchRepository.save(savedDispatch);

      await this.writeLog(savedDispatch.id, DispatchLogType.SUCCESS, DispatchLogStatus.SUCCESS, {
        providerMessageId,
      });

      messageRequest.status = MessageRequestStatus.COMPLETED;
      messageRequest.completedAt = new Date();
      await this.messageRequestRepository.save(messageRequest);
    } catch (error) {
      savedDispatch.status = MessageDispatchStatus.FAILED;
      savedDispatch.failedAt = new Date();
      savedDispatch.lastErrorCode = 'EMAIL_SEND_FAILED';
      savedDispatch.lastErrorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.messageDispatchRepository.save(savedDispatch);

      await this.writeLog(savedDispatch.id, DispatchLogType.FAIL, DispatchLogStatus.FAILED, {
        error: savedDispatch.lastErrorMessage,
      });

      messageRequest.status = MessageRequestStatus.FAILED;
      await this.messageRequestRepository.save(messageRequest);
    }
  }

  private async writeLog(
    dispatchId: string,
    logType: DispatchLogType,
    status: DispatchLogStatus,
    response: Record<string, unknown>,
  ): Promise<void> {
    const log = this.messageDispatchLogRepository.create({
      dispatchId,
      logType,
      status,
      providerCode: 'AWS_SES',
      providerMessage: null,
      rawRequest: null,
      rawResponse: response,
      loggedAt: new Date(),
    });

    await this.messageDispatchLogRepository.save(log);
  }
}
