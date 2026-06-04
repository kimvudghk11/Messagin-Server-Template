import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '@app/kafka';
import { PayloadCryptoModule } from '@app/common';
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
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().default('postgres'),
        DB_PASSWORD: Joi.string().default('postgres'),
        DB_NAME: Joi.string().default('messaging'),
        KAFKA_BROKERS: Joi.string().default('localhost:9092'),
        PAYLOAD_ENCRYPTION_KEY: Joi.string().required(),
      }),
      validationOptions: { allowUnknown: true },
    }),
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
    PayloadCryptoModule,
  ],
  controllers: [MainController],
  providers: [MainService, RetrySchedulerService, OutboxRelayService],
})
export class MainModule { }
