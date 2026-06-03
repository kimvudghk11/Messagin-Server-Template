import { Controller, Get } from '@nestjs/common';

@Controller()
export class WorkerEmailController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
