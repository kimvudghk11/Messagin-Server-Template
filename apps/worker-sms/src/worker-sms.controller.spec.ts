import { Test, TestingModule } from '@nestjs/testing';
import { WorkerSmsController } from './worker-sms.controller';

describe('WorkerSmsController', () => {
  let workerSmsController: WorkerSmsController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkerSmsController],
    }).compile();

    workerSmsController = app.get<WorkerSmsController>(WorkerSmsController);
  });

  describe('health', () => {
    it('should return ok status', () => {
      expect(workerSmsController.health()).toEqual({ status: 'ok' });
    });
  });
});
