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
import { WorkerEmailController } from './worker-email.controller';
import { WorkerEmailService } from './worker-email.service';

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
  controllers: [WorkerEmailController],
  providers: [WorkerEmailService],
})
export class WorkerEmailModule {}
