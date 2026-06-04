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
import { WorkerKakaoController } from './worker-kakao.controller';
import { WorkerKakaoService } from './worker-kakao.service';

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
  controllers: [WorkerKakaoController],
  providers: [WorkerKakaoService],
})
export class WorkerKakaoModule {}
