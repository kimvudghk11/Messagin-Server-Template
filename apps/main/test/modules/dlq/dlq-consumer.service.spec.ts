import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ChannelType, MessageDlqEntity } from '@app/database';
import { MessageDlqEvent } from '@app/contracts';
import { DlqConsumerService } from '../../../src/modules/dlq/dlq-consumer.service';

function makeDlqEvent(overrides: Partial<MessageDlqEvent> = {}): MessageDlqEvent {
  return {
    messageRequestId: 'req-uuid',
    requestId: 'req-001',
    recipientId: 'rec-uuid',
    clientAppId: 'app-uuid',
    templateCode: 'WELCOME',
    channel: 'EMAIL',
    receiver: { email: 'user@example.com' },
    variables: { name: 'Alice' },
    priority: 'NORMAL',
    callbackUrl: null,
    requestedAt: new Date().toISOString(),
    dispatchId: 'dispatch-uuid',
    errorCode: 'EMAIL_SEND_FAILED',
    errorMessage: 'SMTP connection refused',
    retryCount: 3,
    failedAt: '2026-06-04T12:00:00.000Z',
    ...overrides,
  };
}

describe('DlqConsumerService', () => {
  let service: DlqConsumerService;
  let dlqRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    dlqRepo = { create: jest.fn(), save: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqConsumerService,
        { provide: getRepositoryToken(MessageDlqEntity), useValue: dlqRepo },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    service = module.get(DlqConsumerService);
  });

  describe('saveDlqEntry', () => {
    it('saves DLQ entry with all required fields', async () => {
      const event = makeDlqEvent();
      dlqRepo.create.mockReturnValue({ id: 'dlq-uuid' });
      dlqRepo.save.mockResolvedValue({ id: 'dlq-uuid' });

      await (service as unknown as { saveDlqEntry: (e: MessageDlqEvent) => Promise<void> })
        .saveDlqEntry(event);

      expect(dlqRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messageRequestId: 'req-uuid',
          dispatchId: 'dispatch-uuid',
          recipientId: 'rec-uuid',
          channelType: ChannelType.EMAIL,
          errorCode: 'EMAIL_SEND_FAILED',
          errorMessage: 'SMTP connection refused',
          retryCount: 3,
          failedAt: new Date('2026-06-04T12:00:00.000Z'),
        }),
      );
      expect(dlqRepo.save).toHaveBeenCalledTimes(1);
    });

    it('preserves full original event in originalEvent field', async () => {
      const event = makeDlqEvent();
      dlqRepo.create.mockReturnValue({ id: 'dlq-uuid' });
      dlqRepo.save.mockResolvedValue({ id: 'dlq-uuid' });

      await (service as unknown as { saveDlqEntry: (e: MessageDlqEvent) => Promise<void> })
        .saveDlqEntry(event);

      expect(dlqRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalEvent: expect.objectContaining({
            messageRequestId: 'req-uuid',
            errorCode: 'EMAIL_SEND_FAILED',
            variables: { name: 'Alice' },
          }),
        }),
      );
    });
  });
});
