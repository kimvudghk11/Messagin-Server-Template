import { Controller, Get } from '@nestjs/common';
import { WorkerEmailService } from './worker-email.service';

@Controller()
export class WorkerEmailController {
  constructor(private readonly workerEmailService: WorkerEmailService) {}

  @Get()
  getHello(): string {
    return this.workerEmailService.getHello();
  }
}
