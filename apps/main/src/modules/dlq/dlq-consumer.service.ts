import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consumer, Kafka } from 'kafkajs';
import { ChannelType, MessageDlqEntity } from '@app/database';
import { MessageDlqEvent } from '@app/contracts';

@Injectable()
export class DlqConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DlqConsumerService.name);
  private consumer!: Consumer;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(MessageDlqEntity)
    private readonly dlqRepository: Repository<MessageDlqEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const kafka = new Kafka({
      clientId: this.configService.get<string>('KAFKA_DLQ_CLIENT_ID', 'main-dlq-consumer'),
      brokers,
    });

    this.consumer = kafka.consumer({
      groupId: this.configService.get<string>('KAFKA_DLQ_CONSUMER_GROUP_ID', 'dlq-consumer-group'),
    });

    const topic = this.configService.get<string>('KAFKA_TOPIC_MESSAGE_DLQ', 'message.dlq');
    await this.consumer.connect();
    await this.consumer.subscribe({ topic, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const event = JSON.parse(message.value.toString()) as MessageDlqEvent;
          await this.saveDlqEntry(event);
        } catch (error) {
          this.logger.error(
            'Failed to process DLQ message',
            error instanceof Error ? error.stack : error,
          );
        }
      },
    });

    this.logger.log(`DLQ consumer started: topic=${topic}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }

  private async saveDlqEntry(event: MessageDlqEvent): Promise<void> {
    const entry = this.dlqRepository.create({
      messageRequestId: event.messageRequestId,
      dispatchId: event.dispatchId,
      recipientId: event.recipientId,
      channelType: event.channel as ChannelType,
      errorCode: event.errorCode,
      errorMessage: event.errorMessage,
      retryCount: event.retryCount,
      originalEvent: event as unknown as Record<string, unknown>,
      failedAt: new Date(event.failedAt),
    });
    await this.dlqRepository.save(entry);
    this.logger.log(
      `DLQ entry saved: messageRequestId=${event.messageRequestId}, dispatchId=${event.dispatchId}`,
    );
  }
}
