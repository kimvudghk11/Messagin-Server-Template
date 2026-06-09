import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { DlqService } from './dlq.service';

@ApiTags('Dead Letter Queue')
@ApiHeader({ name: 'x-api-key', required: true, description: 'Admin API Key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: 'Admin API Key Secret' })
@UseGuards(AdminAuthGuard)
@Controller('admin/dlq')
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}

  @ApiOperation({ summary: 'DLQ 목록 조회 (최신순)' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호 (기본값: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 건수 (기본값: 20, 최대: 100)' })
  @ApiOkResponse({ description: 'DLQ 목록 반환' })
  @ApiUnauthorizedResponse({ description: 'Admin 키 인증 실패' })
  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.dlqService.findAll(Number(page), Math.min(Number(limit), 100));
  }
}
