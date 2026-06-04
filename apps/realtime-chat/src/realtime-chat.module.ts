import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChatMessageEntity,
  ChatMessageReadEntity,
  ChatRoomEntity,
  ChatRoomParticipantEntity,
  ClientApiKeyEntity,
  ClientAppEntity,
  createTypeOrmConfig,
} from '@app/database';
import { ChatGateway } from './chat.gateway';
import { ChatRoomService } from './chat-room.service';
import { RealtimeChatController } from './realtime-chat.controller';
import { RealtimeChatService } from './realtime-chat.service';
import { WsAuthService } from './ws-auth.service';

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
        REDIS_URL: Joi.string().default('redis://localhost:6379'),
      }),
      validationOptions: { allowUnknown: true },
    }),
    TypeOrmModule.forRoot(createTypeOrmConfig([
      ChatRoomEntity,
      ChatRoomParticipantEntity,
      ChatMessageEntity,
      ChatMessageReadEntity,
      ClientApiKeyEntity,
      ClientAppEntity,
    ])),
    TypeOrmModule.forFeature([
      ChatRoomEntity,
      ChatRoomParticipantEntity,
      ChatMessageEntity,
      ChatMessageReadEntity,
      ClientApiKeyEntity,
      ClientAppEntity,
    ]),
  ],
  controllers: [RealtimeChatController],
  providers: [RealtimeChatService, ChatGateway, ChatRoomService, WsAuthService],
})
export class RealtimeChatModule {}
