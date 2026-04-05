import { Controller, Get } from '@nestjs/common';
import { WorkerSmsService } from './worker-sms.service';

@Controller()
export class WorkerSmsController {
  constructor(private readonly workerSmsService: WorkerSmsService) {}

  @Get()
  getHello(): string {
    return this.workerSmsService.getHello();
  }
}
