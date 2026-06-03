import { Test, TestingModule } from '@nestjs/testing';
import { WorkerEmailController } from './worker-email.controller';

describe('WorkerEmailController', () => {
  let workerEmailController: WorkerEmailController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkerEmailController],
    }).compile();

    workerEmailController = app.get<WorkerEmailController>(WorkerEmailController);
  });

  describe('health', () => {
    it('should return ok status', () => {
      expect(workerEmailController.health()).toEqual({ status: 'ok' });
    });
  });
});
