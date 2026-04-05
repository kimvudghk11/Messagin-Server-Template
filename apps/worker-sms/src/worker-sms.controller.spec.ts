import { Test, TestingModule } from '@nestjs/testing';
import { WorkerSmsController } from './worker-sms.controller';
import { WorkerSmsService } from './worker-sms.service';

describe('WorkerSmsController', () => {
  let workerSmsController: WorkerSmsController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkerSmsController],
      providers: [WorkerSmsService],
    }).compile();

    workerSmsController = app.get<WorkerSmsController>(WorkerSmsController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(workerSmsController.getHello()).toBe('Hello World!');
    });
  });
});
