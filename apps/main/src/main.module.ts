import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '@app/kafka';
import {
  MessageDispatchEntity,
  MessageOutboxEntity,
  MessagePayloadEntity,
  MessageRecipientEntity,
  MessageRequestEntity,
  createTypeOrmConfig,
} from '@app/database';
import { MainController } from './main.controller';
import { MainService } from './main.service';
import { RetrySchedulerService } from './modules/retry-scheduler/retry-scheduler.service';
import { OutboxRelayService } from './modules/outbox-relay/outbox-relay.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot(createTypeOrmConfig([
      MessageRequestEntity,
      MessageDispatchEntity,
      MessagePayloadEntity,
      MessageRecipientEntity,
      MessageOutboxEntity,
    ])),
    TypeOrmModule.forFeature([
      MessageRequestEntity,
      MessageDispatchEntity,
      MessagePayloadEntity,
      MessageRecipientEntity,
      MessageOutboxEntity,
    ]),
    KafkaModule,
  ],
  controllers: [MainController],
  providers: [MainService, RetrySchedulerService, OutboxRelayService],
})
export class MainModule { }
