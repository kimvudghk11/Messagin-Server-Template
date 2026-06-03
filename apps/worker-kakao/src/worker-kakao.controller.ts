import { Controller, Get } from '@nestjs/common';

@Controller()
export class WorkerKakaoController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
