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

@ApiTags('Admin Client API Key')
@Controller('admin/client-apps/:clientAppId/api-keys')
export class ClientApiKeyController {
  constructor(private readonly clientApiKeyService: ClientApiKeyService) { }

  @ApiOperation({ summary: 'Issue API key for a client app' })
  @ApiParam({ name: 'clientAppId', description: 'Client app UUID' })
  @ApiBody({ type: CreateClientApiKeyDto })
  @ApiCreatedResponse({ description: 'API key issued' })
  @Post()
  create(@Param('clientAppId') clientAppId: string, @Body() dto: CreateClientApiKeyDto) {
    return this.clientApiKeyService.create(clientAppId, dto);
  }
}
