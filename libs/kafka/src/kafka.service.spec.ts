import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';

const mockProducer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: jest.fn().mockReturnValue(mockProducer),
  })),
}));

describe('KafkaService', () => {
  let service: KafkaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const configService = {
      get: jest.fn((key: string, defaultVal?: string) => {
        const map: Record<string, string> = {
          KAFKA_BROKERS: 'localhost:9092',
          KAFKA_CLIENT_ID: 'test-client',
          KAFKA_TOPIC_MESSAGE_SEND: 'message.send',
        };
        return map[key] ?? defaultVal ?? '';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(KafkaService);
  });

  describe('onModuleInit', () => {
    it('connects the producer on init', async () => {
      await service.onModuleInit();

      expect(mockProducer.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('disconnects producer after init', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockProducer.disconnect).toHaveBeenCalledTimes(1);
    });

    it('does not disconnect if never connected', async () => {
      await service.onModuleDestroy();

      expect(mockProducer.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('sends message to specified topic with JSON-serialized value', async () => {
      await service.onModuleInit();
      mockProducer.send.mockResolvedValue([]);

      await service.publish('test-topic', 'key-1', { hello: 'world' });

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'test-topic',
        messages: [{ key: 'key-1', value: JSON.stringify({ hello: 'world' }) }],
      });
    });
  });

  describe('publishMessageSend', () => {
    it('uses KAFKA_TOPIC_MESSAGE_SEND topic', async () => {
      await service.onModuleInit();
      mockProducer.send.mockResolvedValue([]);

      const event = {
        messageRequestId: 'req-uuid',
        requestId: 'req-001',
        recipientId: 'rec-uuid',
        clientAppId: 'app-uuid',
        templateCode: 'WELCOME',
        channel: 'EMAIL',
        receiver: {},
        variables: {},
        priority: 'NORMAL',
        callbackUrl: null,
        requestedAt: new Date().toISOString(),
      };

      await service.publishMessageSend(event);

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'message.send' }),
      );
    });

    it('uses requestId as the message partition key', async () => {
      await service.onModuleInit();
      mockProducer.send.mockResolvedValue([]);

      const event = {
        messageRequestId: 'req-uuid',
        requestId: 'my-request-id',
        recipientId: 'rec-uuid',
        clientAppId: 'app-uuid',
        templateCode: 'WELCOME',
        channel: 'EMAIL',
        receiver: {},
        variables: {},
        priority: 'NORMAL',
        callbackUrl: null,
        requestedAt: new Date().toISOString(),
      };

      await service.publishMessageSend(event);

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ key: 'my-request-id' }),
          ]),
        }),
      );
    });
  });
});
