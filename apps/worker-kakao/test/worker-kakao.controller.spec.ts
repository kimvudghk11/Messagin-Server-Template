import { Test, TestingModule } from '@nestjs/testing';
import { WorkerKakaoController } from '../src/worker-kakao.controller';

describe('WorkerKakaoController', () => {
  let workerKakaoController: WorkerKakaoController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkerKakaoController],
    }).compile();

    workerKakaoController = app.get<WorkerKakaoController>(WorkerKakaoController);
  });

  describe('health', () => {
    it('should return ok status', () => {
      expect(workerKakaoController.health()).toEqual({ status: 'ok' });
    });
  });
});
