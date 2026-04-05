import { Module } from '@nestjs/common';
import { WorkerKakaoController } from './worker-kakao.controller';
import { WorkerKakaoService } from './worker-kakao.service';

@Module({
  imports: [],
  controllers: [WorkerKakaoController],
  providers: [WorkerKakaoService],
})
export class WorkerKakaoModule {}
