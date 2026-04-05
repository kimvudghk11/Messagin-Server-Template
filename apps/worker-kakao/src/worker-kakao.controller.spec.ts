import { Test, TestingModule } from '@nestjs/testing';
import { WorkerKakaoController } from './worker-kakao.controller';
import { WorkerKakaoService } from './worker-kakao.service';

describe('WorkerKakaoController', () => {
  let workerKakaoController: WorkerKakaoController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkerKakaoController],
      providers: [WorkerKakaoService],
    }).compile();

    workerKakaoController = app.get<WorkerKakaoController>(WorkerKakaoController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(workerKakaoController.getHello()).toBe('Hello World!');
    });
  });
});
