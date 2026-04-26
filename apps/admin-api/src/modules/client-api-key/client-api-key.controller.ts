import { Body, Controller, Param, Post } from '@nestjs/common';
import { ClientApiKeyService } from './client-api-key.service';
import { CreateClientApiKeyDto } from './dto/create-client-api-key.dto';

@Controller('admin/client-apps/:clientAppId/api-keys')
export class ClientApiKeyController {
  constructor(private readonly clientApiKeyService: ClientApiKeyService) { }

  @Post()
  create(@Param('clientAppId') clientAppId: string, @Body() dto: CreateClientApiKeyDto) {
    return this.clientApiKeyService.create(clientAppId, dto);
  }
}
