import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AdminActionType, AdminTargetType } from '@app/database';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { AdminAuditLogService } from '../audit-log/admin-audit-log.service';
import { ClientApiKeyService } from './client-api-key.service';
import { CreateClientApiKeyDto } from './dto/create-client-api-key.dto';

@ApiTags('관리자 클라이언트 API Key')
@ApiHeader({ name: 'x-api-key', required: true, description: 'Admin API Key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: 'Admin API Key Secret' })
@UseGuards(AdminAuthGuard)
@Controller('admin/client-apps/:clientAppId/api-keys')
export class ClientApiKeyController {
  constructor(
    private readonly clientApiKeyService: ClientApiKeyService,
    private readonly auditLogService: AdminAuditLogService,
  ) {}

  @ApiOperation({ summary: '클라이언트 앱 API Key 발급' })
  @ApiParam({ name: 'clientAppId', description: '클라이언트 앱 UUID' })
  @ApiBody({ type: CreateClientApiKeyDto })
  @ApiCreatedResponse({ description: 'API Key 발급 완료' })
  @ApiUnauthorizedResponse({ description: 'Admin 키 인증 실패' })
  @Post()
  async create(
    @Param('clientAppId') clientAppId: string,
    @Body() dto: CreateClientApiKeyDto,
    @Req() req: Request,
  ) {
    const result = await this.clientApiKeyService.create(clientAppId, dto);

    await this.auditLogService.log({
      adminKeyId: (req as unknown as Record<string, unknown>)['adminKeyId'] as string,
      actionType: AdminActionType.CREATE_API_KEY,
      targetType: AdminTargetType.API_KEY,
      targetId: result.id,
      afterData: {
        keyId: result.keyId,
        keyName: result.keyName,
        keyType: result.keyType,
        clientAppId: result.clientAppId,
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }
}
