import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ClientPermissionType } from '@app/database';
import { ClientAuthGuard, RequestWithClient } from '../../guards/client-auth.guard';
import { ClientPermissionGuard } from '../../guards/client-permission.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { SendMessageRequestDto } from './dto/send-message-request.dto';
import { MessageRequestService } from './message-request.service';

@ApiTags('메시지 요청')
@ApiHeader({ name: 'x-api-key', required: true, description: '발급된 API Key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: '발급된 API Key Secret' })
@UseGuards(ClientAuthGuard, RateLimitGuard, ClientPermissionGuard)
@Controller('messages')
export class MessageRequestController {
  constructor(private readonly messageRequestService: MessageRequestService) { }

  @ApiOperation({ summary: '메시지 요청 생성' })
  @ApiBody({ type: SendMessageRequestDto })
  @ApiCreatedResponse({ description: '메시지 요청 생성 완료' })
  @ApiUnauthorizedResponse({ description: 'API Key 인증 실패' })
  @ApiForbiddenResponse({ description: 'SEND_MESSAGE 권한 없음' })
  @ApiTooManyRequestsResponse({ description: '분당 요청 한도 초과' })
  @RequirePermission(ClientPermissionType.SEND_MESSAGE)
  @Post('send')
  async send(@Req() request: RequestWithClient, @Body() dto: SendMessageRequestDto) {
    return this.messageRequestService.send(request.client, dto);
  }
}
