import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ChatRoomService } from './chat-room.service';
import { RealtimeChatService } from './realtime-chat.service';

class MarkReadDto {
  @IsUUID()
  @IsNotEmpty()
  messageId!: string;

  @IsUUID()
  @IsNotEmpty()
  userId!: string;
}

@ApiTags('Chat')
@Controller('chat')
export class RealtimeChatController {
  constructor(
    private readonly realtimeChatService: RealtimeChatService,
    private readonly chatRoomService: ChatRoomService,
  ) {}

  @Get('health')
  health(): { status: string } {
    return this.realtimeChatService.health();
  }

  @Post('rooms/:roomId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '메시지 읽음 처리' })
  async markRead(
    @Param('roomId') roomId: string,
    @Body() dto: MarkReadDto,
  ): Promise<void> {
    void roomId;
    await this.chatRoomService.markRead(dto.messageId, dto.userId);
  }
}
