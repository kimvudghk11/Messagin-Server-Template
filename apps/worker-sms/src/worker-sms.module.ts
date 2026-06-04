import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PayloadCryptoModule } from '@app/common';
import {
  MessageDispatchEntity,
  MessageDispatchLogEntity,
  MessageRequestEntity,
  createTypeOrmConfig,
} from '@app/database';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerSmsController } from './worker-sms.controller';
import { WorkerSmsService } from './worker-sms.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(createTypeOrmConfig([
      MessageRequestEntity,
      MessageDispatchEntity,
      MessageDispatchLogEntity,
    ])),
    TypeOrmModule.forFeature([MessageRequestEntity, MessageDispatchEntity, MessageDispatchLogEntity]),
    PayloadCryptoModule,
  ],
  controllers: [WorkerSmsController],
  providers: [WorkerSmsService],
})
export class WorkerSmsModule {}
