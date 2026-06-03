import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { ClientApiKeyService } from './client-api-key.service';
import { CreateClientApiKeyDto } from './dto/create-client-api-key.dto';

@ApiTags('관리자 클라이언트 API Key')
@ApiHeader({ name: 'x-api-key', required: true, description: 'Admin API Key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: 'Admin API Key Secret' })
@UseGuards(AdminAuthGuard)
@Controller('admin/client-apps/:clientAppId/api-keys')
export class ClientApiKeyController {
  constructor(private readonly clientApiKeyService: ClientApiKeyService) { }

  @ApiOperation({ summary: '클라이언트 앱 API Key 발급' })
  @ApiParam({ name: 'clientAppId', description: '클라이언트 앱 UUID' })
  @ApiBody({ type: CreateClientApiKeyDto })
  @ApiCreatedResponse({ description: 'API Key 발급 완료' })
  @ApiUnauthorizedResponse({ description: 'Admin 키 인증 실패' })
  @Post()
  create(@Param('clientAppId') clientAppId: string, @Body() dto: CreateClientApiKeyDto) {
    return this.clientApiKeyService.create(clientAppId, dto);
  }
}
