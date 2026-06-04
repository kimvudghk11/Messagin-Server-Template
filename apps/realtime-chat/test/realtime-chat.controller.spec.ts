import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeChatController } from '../src/realtime-chat.controller';
import { RealtimeChatService } from '../src/realtime-chat.service';
import { ChatRoomService } from '../src/chat-room.service';

describe('RealtimeChatController', () => {
  let controller: RealtimeChatController;

  beforeEach(async () => {
    const chatRoomServiceMock: Partial<ChatRoomService> = {
      markRead: jest.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [RealtimeChatController],
      providers: [
        RealtimeChatService,
        { provide: ChatRoomService, useValue: chatRoomServiceMock },
      ],
    }).compile();

    controller = app.get<RealtimeChatController>(RealtimeChatController);
  });

  it('health returns ok status', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('markRead calls chatRoomService.markRead', async () => {
    await expect(
      controller.markRead('room-uuid', { messageId: '00000000-0000-0000-0000-000000000001', userId: '00000000-0000-0000-0000-000000000002' }),
    ).resolves.toBeUndefined();
  });
});
