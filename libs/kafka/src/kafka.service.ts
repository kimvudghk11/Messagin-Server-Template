import { MessageSendEvent } from '@app/contracts';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private readonly producer: Producer;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const kafka = new Kafka({
      clientId: this.configService.get<string>('KAFKA_CLIENT_ID', 'messaging-api-gateway'),
      brokers,
    });

    this.producer = kafka.producer();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    await this.producer.disconnect();
    this.isConnected = false;
  }

  async publishMessageSend(event: MessageSendEvent): Promise<void> {
    const topic = this.configService.get<string>('KAFKA_TOPIC_MESSAGE_SEND', 'message.send');

    await this.publish(topic, event.requestId, event);
  }

  async publish(topic: string, key: string, payload: unknown): Promise<void> {
    await this.ensureConnected();

    await this.producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(payload),
        },
      ],
    });

    this.logger.debug(`Kafka message published: topic=${topic}, key=${key}`);
  }

  private async ensureConnected(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    await this.producer.connect();
    this.isConnected = true;
  }
}
