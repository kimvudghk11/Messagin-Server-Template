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

@ApiTags('Message Request')
@ApiHeader({ name: 'x-api-key', required: true, description: 'Issued API key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: 'Issued API key secret' })
@Controller('messages')
export class MessageRequestController {
  constructor(
    private readonly clientAuthService: ClientAuthService,
    private readonly messageRequestService: MessageRequestService,
  ) { }

  @ApiOperation({ summary: 'Create message request' })
  @ApiBody({ type: SendMessageRequestDto })
  @ApiCreatedResponse({ description: 'Message request created' })
  @Post('send')
  async send(@Req() request: HeaderAccessibleRequest, @Body() dto: SendMessageRequestDto) {
    const auth = await this.clientAuthService.authenticate(request);
    return this.messageRequestService.send(auth, dto);
  }
}
