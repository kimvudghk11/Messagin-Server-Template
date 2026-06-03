import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ClientAuthGuard, RequestWithClient } from '../../guards/client-auth.guard';
import { TemplateService } from './template.service';

@ApiTags('템플릿')
@ApiHeader({ name: 'x-api-key', required: true, description: '발급된 API Key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: '발급된 API Key Secret' })
@UseGuards(ClientAuthGuard)
@Controller()
export class TemplateController {
  constructor(private readonly templateService: TemplateService) { }

  @ApiOperation({ summary: '템플릿 코드로 템플릿 조회' })
  @ApiParam({ name: 'code', description: '템플릿 코드' })
  @ApiOkResponse({ description: '템플릿 상세 정보' })
  @Get('templates/:code')
  async getTemplateByCode(@Param('code') code: string, @Req() request: RequestWithClient) {
    return this.templateService.getTemplateByCode(code, request.client.clientAppId);
  }

  @ApiOperation({ summary: '템플릿 코드로 변수 목록 조회' })
  @ApiParam({ name: 'code', description: '템플릿 코드' })
  @ApiOkResponse({ description: '템플릿 변수 목록' })
  @Get('templates/:code/variables')
  async getTemplateVariables(@Param('code') code: string, @Req() request: RequestWithClient) {
    return this.templateService.getTemplateVariables(code, request.client.clientAppId);
  }

  @ApiOperation({ summary: '인증된 클라이언트가 사용 가능한 템플릿 조회' })
  @ApiOkResponse({ description: '사용 가능한 템플릿 목록' })
  @Get('clients/templates')
  async getClientTemplates(@Req() request: RequestWithClient) {
    return this.templateService.getClientAvailableTemplates(request.client.clientAppId);
  }
}
