import { Controller, Get } from '@nestjs/common';

@Controller()
export class BaseWorkerController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
