import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChatMessageEntity,
  ChatMessageReadEntity,
  ChatRoomEntity,
  ChatRoomParticipantEntity,
  ClientApiKeyEntity,
  ClientAppEntity,
} from '@app/database';
import { ChatGateway } from './chat.gateway';
import { ChatRoomService } from './chat-room.service';
import { RealtimeChatController } from './realtime-chat.controller';
import { RealtimeChatService } from './realtime-chat.service';
import { WsAuthService } from './ws-auth.service';

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
      entities: [
        ChatRoomEntity,
        ChatRoomParticipantEntity,
        ChatMessageEntity,
        ChatMessageReadEntity,
        ClientApiKeyEntity,
        ClientAppEntity,
      ],
      synchronize: false,
      logging: false,
    }),
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
