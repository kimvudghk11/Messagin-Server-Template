import { Controller, Get } from '@nestjs/common';

@Controller()
export class WorkerSmsController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
