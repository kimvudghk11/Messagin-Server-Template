import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeChatController } from './realtime-chat.controller';
import { RealtimeChatService } from './realtime-chat.service';

describe('RealtimeChatController', () => {
  let realtimeChatController: RealtimeChatController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [RealtimeChatController],
      providers: [RealtimeChatService],
    }).compile();

    realtimeChatController = app.get<RealtimeChatController>(RealtimeChatController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(realtimeChatController.getHello()).toBe('Hello World!');
    });
  });
});
