import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  MessageDispatchEntity,
  MessageDispatchLogEntity,
  MessageRequestEntity,
} from '@app/database';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerEmailController } from './worker-email.controller';
import { WorkerEmailService } from './worker-email.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'messaging',
      entities: [MessageRequestEntity, MessageDispatchEntity, MessageDispatchLogEntity],
      synchronize: false,
      logging: false,
    }),
    TypeOrmModule.forFeature([MessageRequestEntity, MessageDispatchEntity, MessageDispatchLogEntity]),
  ],
  controllers: [WorkerEmailController],
  providers: [WorkerEmailService],
})
export class WorkerEmailModule { }
