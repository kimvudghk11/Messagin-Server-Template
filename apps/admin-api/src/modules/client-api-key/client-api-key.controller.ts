import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ClientApiKeyService } from './client-api-key.service';
import { CreateClientApiKeyDto } from './dto/create-client-api-key.dto';

@ApiTags('관리자 클라이언트 API Key')
@Controller('admin/client-apps/:clientAppId/api-keys')
export class ClientApiKeyController {
  constructor(private readonly clientApiKeyService: ClientApiKeyService) { }

  @ApiOperation({ summary: '클라이언트 앱 API Key 발급' })
  @ApiParam({ name: 'clientAppId', description: '클라이언트 앱 UUID' })
  @ApiBody({ type: CreateClientApiKeyDto })
  @ApiCreatedResponse({ description: 'API Key 발급 완료' })
  @Post()
  create(@Param('clientAppId') clientAppId: string, @Body() dto: CreateClientApiKeyDto) {
    return this.clientApiKeyService.create(clientAppId, dto);
  }
}
