import { Module } from '@nestjs/common';
import { WorkerSmsController } from './worker-sms.controller';
import { WorkerSmsService } from './worker-sms.service';

@Module({
  imports: [],
  controllers: [WorkerSmsController],
  providers: [WorkerSmsService],
})
export class WorkerSmsModule {}
