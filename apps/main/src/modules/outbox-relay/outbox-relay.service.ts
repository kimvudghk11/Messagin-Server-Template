import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageOutboxEntity, OutboxEventType, OutboxStatus } from '@app/database';
import { KafkaService } from '@app/kafka';
import { MessageSendEvent } from '@app/contracts';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(MessageOutboxEntity)
    private readonly outboxRepository: Repository<MessageOutboxEntity>,
    private readonly kafkaService: KafkaService,
  ) { }

  @Cron('*/30 * * * * *') // every 30 seconds
  async relayPendingEvents(): Promise<void> {
    const pending = await this.outboxRepository.find({
      where: { status: OutboxStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: 100,
    });

    if (pending.length === 0) return;

    this.logger.log(`Relaying ${pending.length} outbox events`);

    for (const entry of pending) {
      await this.relayEvent(entry);
    }
  }

  private async relayEvent(entry: MessageOutboxEntity): Promise<void> {
    try {
      if (entry.eventType === OutboxEventType.MESSAGE_REQUEST_CREATED) {
        const event = entry.payload as MessageSendEvent;
        await this.kafkaService.publishMessageSend(event);
      } else {
        const topic = this.configService.get<string>('KAFKA_TOPIC_MESSAGE_SEND', 'message.send');
        await this.kafkaService.publish(topic, entry.eventKey, entry.payload);
      }

      entry.status = OutboxStatus.PUBLISHED;
      entry.publishedAt = new Date();
      entry.errorMessage = null;
    } catch (error) {
      entry.status = OutboxStatus.FAILED;
      entry.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to relay outbox event ${entry.id}`, error instanceof Error ? error.stack : error);
    }

    await this.outboxRepository.save(entry);
  }
}
