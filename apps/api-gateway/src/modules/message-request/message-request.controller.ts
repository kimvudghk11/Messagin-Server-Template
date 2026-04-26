import { Body, Controller, Post, Req } from '@nestjs/common';
import { ClientAuthService, HeaderAccessibleRequest } from '../auth/client-auth.service';
import { SendMessageRequestDto } from './dto/send-message-request.dto';
import { MessageRequestService } from './message-request.service';

@Controller('messages')
export class MessageRequestController {
  constructor(
    private readonly clientAuthService: ClientAuthService,
    private readonly messageRequestService: MessageRequestService,
  ) { }

  @Post('send')
  async send(@Req() request: HeaderAccessibleRequest, @Body() dto: SendMessageRequestDto) {
    const auth = await this.clientAuthService.authenticate(request);
    return this.messageRequestService.send(auth, dto);
  }
}
