import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ClientAuthService, HeaderAccessibleRequest } from '../auth/client-auth.service';
import { SendMessageRequestDto } from './dto/send-message-request.dto';
import { MessageRequestService } from './message-request.service';

@ApiTags('메시지 요청')
@ApiHeader({ name: 'x-api-key', required: true, description: '발급된 API Key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: '발급된 API Key Secret' })
@Controller('messages')
export class MessageRequestController {
  constructor(
    private readonly clientAuthService: ClientAuthService,
    private readonly messageRequestService: MessageRequestService,
  ) { }

  @ApiOperation({ summary: '메시지 요청 생성' })
  @ApiBody({ type: SendMessageRequestDto })
  @ApiCreatedResponse({ description: '메시지 요청 생성 완료' })
  @Post('send')
  async send(@Req() request: HeaderAccessibleRequest, @Body() dto: SendMessageRequestDto) {
    const auth = await this.clientAuthService.authenticate(request);
    return this.messageRequestService.send(auth, dto);
  }
}
