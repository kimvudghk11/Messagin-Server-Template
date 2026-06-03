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
} from '@app/database';
import { MainController } from './main.controller';
import { MainService } from './main.service';
import { RetrySchedulerService } from './modules/retry-scheduler/retry-scheduler.service';
import { OutboxRelayService } from './modules/outbox-relay/outbox-relay.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'messaging',
      entities: [
        MessageRequestEntity,
        MessageDispatchEntity,
        MessagePayloadEntity,
        MessageRecipientEntity,
        MessageOutboxEntity,
      ],
      synchronize: false,
      logging: false,
    }),
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
