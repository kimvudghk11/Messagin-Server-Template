import { Test, TestingModule } from '@nestjs/testing';
import { WorkerEmailController } from './worker-email.controller';
import { WorkerEmailService } from './worker-email.service';

describe('WorkerEmailController', () => {
  let workerEmailController: WorkerEmailController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkerEmailController],
      providers: [WorkerEmailService],
    }).compile();

    workerEmailController = app.get<WorkerEmailController>(WorkerEmailController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(workerEmailController.getHello()).toBe('Hello World!');
    });
  });
});
