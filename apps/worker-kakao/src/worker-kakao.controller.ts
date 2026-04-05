import { Controller, Get } from '@nestjs/common';
import { WorkerKakaoService } from './worker-kakao.service';

@Controller()
export class WorkerKakaoController {
  constructor(private readonly workerKakaoService: WorkerKakaoService) {}

  @Get()
  getHello(): string {
    return this.workerKakaoService.getHello();
  }
}
