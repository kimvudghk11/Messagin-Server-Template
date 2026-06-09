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
import { MessageDlqEvent, MessageSendEvent } from '@app/contracts';
import { PayloadCryptoService } from '@app/common';
import { KafkaService } from '../kafka.service';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Consumer, Kafka } from 'kafkajs';
import { Repository } from 'typeorm';

const RETRY_BACKOFF_SECONDS = [60, 300, 900];

@Injectable()
export abstract class BaseWorkerService implements OnModuleInit, OnModuleDestroy {
  protected abstract readonly channelType: ChannelType;
  protected abstract readonly kafkaClientIdEnvKey: string;
  protected abstract readonly kafkaClientIdDefault: string;
  protected abstract readonly kafkaGroupIdEnvKey: string;
  protected abstract readonly kafkaGroupIdDefault: string;
  protected abstract readonly providerType: ProviderType;
  protected abstract readonly errorCode: string;

  protected readonly logger: Logger;
  private consumer!: Consumer;

  constructor(
    protected readonly configService: ConfigService,
    @InjectRepository(MessageRequestEntity)
    protected readonly messageRequestRepository: Repository<MessageRequestEntity>,
    @InjectRepository(MessageDispatchEntity)
    protected readonly messageDispatchRepository: Repository<MessageDispatchEntity>,
    @InjectRepository(MessageDispatchLogEntity)
    protected readonly messageDispatchLogRepository: Repository<MessageDispatchLogEntity>,
    @Optional() private readonly payloadCryptoService?: PayloadCryptoService,
    @Optional() private readonly kafkaService?: KafkaService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  async onModuleInit(): Promise<void> {
    const brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const kafka = new Kafka({
      clientId: this.configService.get<string>(this.kafkaClientIdEnvKey, this.kafkaClientIdDefault),
      brokers,
    });

    this.consumer = kafka.consumer({
      groupId: this.configService.get<string>(this.kafkaGroupIdEnvKey, this.kafkaGroupIdDefault),
    });

    const topic = this.configService.get<string>('KAFKA_TOPIC_MESSAGE_SEND', 'message.send');
    await this.consumer.connect();
    await this.consumer.subscribe({ topic, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const event = JSON.parse(message.value.toString()) as MessageSendEvent;
          if (event.channel !== this.channelType) return;
          if (this.payloadCryptoService?.isEncrypted(event.variables)) {
            event.variables = this.payloadCryptoService.decrypt(event.variables);
          }
          await this.process(event);
        } catch (error) {
          this.logger.error('Unhandled error in eachMessage', error instanceof Error ? error.stack : error);
        }
      },
    });

    this.logger.log(`${this.channelType} worker consumer started: topic=${topic}`);
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

    const existingSuccess = await this.messageDispatchRepository.findOne({
      where: {
        messageRequestId: event.messageRequestId,
        recipientId: event.recipientId,
        channelType: this.channelType,
        status: MessageDispatchStatus.SUCCESS,
      },
      order: { createdAt: 'DESC' },
    });

    if (existingSuccess) {
      this.logger.log(`dispatch already succeeded, skip: requestId=${event.requestId}`);
      return;
    }

    const dispatch = this.messageDispatchRepository.create({
      messageRequestId: event.messageRequestId,
      recipientId: event.recipientId,
      templateChannelId: null,
      channelType: this.channelType,
      providerType: this.providerType,
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
    await this.writeLog(savedDispatch.id, DispatchLogType.REQUEST, DispatchLogStatus.PROCESSING, { event });

    try {
      const providerMessageId = `${this.channelType.toLowerCase()}_${randomUUID()}`;

      savedDispatch.status = MessageDispatchStatus.SUCCESS;
      savedDispatch.providerMessageId = providerMessageId;
      savedDispatch.sentAt = new Date();
      savedDispatch.successAt = new Date();
      await this.messageDispatchRepository.save(savedDispatch);
      await this.writeLog(savedDispatch.id, DispatchLogType.SUCCESS, DispatchLogStatus.SUCCESS, { providerMessageId });

      messageRequest.status = MessageRequestStatus.COMPLETED;
      messageRequest.completedAt = new Date();
      await this.messageRequestRepository.save(messageRequest);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const canRetry = savedDispatch.retryCount < savedDispatch.maxRetryCount;

      if (canRetry) {
        const backoffSeconds = RETRY_BACKOFF_SECONDS[savedDispatch.retryCount] ?? 900;
        savedDispatch.status = MessageDispatchStatus.RETRY_WAIT;
        savedDispatch.retryCount += 1;
        savedDispatch.nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);
        savedDispatch.lastErrorCode = this.errorCode;
        savedDispatch.lastErrorMessage = errorMessage;
        await this.messageDispatchRepository.save(savedDispatch);
        await this.writeLog(savedDispatch.id, DispatchLogType.RETRY, DispatchLogStatus.FAILED, {
          error: errorMessage,
          nextRetryAt: savedDispatch.nextRetryAt,
          retryCount: savedDispatch.retryCount,
        });
      } else {
        savedDispatch.status = MessageDispatchStatus.FAILED;
        savedDispatch.failedAt = new Date();
        savedDispatch.lastErrorCode = this.errorCode;
        savedDispatch.lastErrorMessage = errorMessage;
        await this.messageDispatchRepository.save(savedDispatch);
        await this.writeLog(savedDispatch.id, DispatchLogType.FAIL, DispatchLogStatus.FAILED, { error: errorMessage });

        messageRequest.status = MessageRequestStatus.FAILED;
        await this.messageRequestRepository.save(messageRequest);

        if (this.kafkaService) {
          const dlqEvent: MessageDlqEvent = {
            ...event,
            dispatchId: savedDispatch.id,
            errorCode: this.errorCode,
            errorMessage,
            retryCount: savedDispatch.retryCount,
            failedAt: (savedDispatch.failedAt as Date).toISOString(),
          };
          try {
            await this.kafkaService.publishDlq(dlqEvent);
          } catch (dlqError) {
            this.logger.error(
              `Failed to publish DLQ event for dispatch ${savedDispatch.id}`,
              dlqError instanceof Error ? dlqError.stack : dlqError,
            );
          }
        }
      }
    }
  }

  private async writeLog(
    dispatchId: string,
    logType: DispatchLogType,
    status: DispatchLogStatus,
    response: Record<string, unknown>,
  ): Promise<void> {
    await this.messageDispatchLogRepository.save(
      this.messageDispatchLogRepository.create({
        dispatchId,
        logType,
        status,
        providerCode: this.providerType,
        providerMessage: null,
        rawRequest: null,
        rawResponse: response,
        loggedAt: new Date(),
      }),
    );
  }
}
