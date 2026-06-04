import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
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
