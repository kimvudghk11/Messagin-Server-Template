import { Module } from '@nestjs/common';
import { RealtimeChatController } from './realtime-chat.controller';
import { RealtimeChatService } from './realtime-chat.service';

@Module({
  imports: [],
  controllers: [RealtimeChatController],
  providers: [RealtimeChatService],
})
export class RealtimeChatModule {}
