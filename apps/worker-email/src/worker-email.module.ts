import { Module } from '@nestjs/common';
import { WorkerEmailController } from './worker-email.controller';
import { WorkerEmailService } from './worker-email.service';

@Module({
  imports: [],
  controllers: [WorkerEmailController],
  providers: [WorkerEmailService],
})
export class WorkerEmailModule {}
