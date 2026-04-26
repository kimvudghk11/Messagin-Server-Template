import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ClientAuthService, HeaderAccessibleRequest } from '../auth/client-auth.service';
import { TemplateService } from './template.service';

@ApiTags('Template')
@ApiHeader({ name: 'x-api-key', required: true, description: 'Issued API key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: 'Issued API key secret' })
@Controller()
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly clientAuthService: ClientAuthService,
  ) { }

  @ApiOperation({ summary: 'Get template by template code' })
  @ApiParam({ name: 'code', description: 'Template code' })
  @ApiOkResponse({ description: 'Template detail' })
  @Get('templates/:code')
  async getTemplateByCode(@Param('code') code: string, @Req() request: HeaderAccessibleRequest) {
    const auth = await this.clientAuthService.authenticate(request);
    return this.templateService.getTemplateByCode(code, auth.clientAppId);
  }

  @ApiOperation({ summary: 'Get template variables by template code' })
  @ApiParam({ name: 'code', description: 'Template code' })
  @ApiOkResponse({ description: 'Template variable list' })
  @Get('templates/:code/variables')
  async getTemplateVariables(@Param('code') code: string, @Req() request: HeaderAccessibleRequest) {
    const auth = await this.clientAuthService.authenticate(request);
    return this.templateService.getTemplateVariables(code, auth.clientAppId);
  }

  @ApiOperation({ summary: 'Get templates available for authenticated client' })
  @ApiOkResponse({ description: 'Available template list' })
  @Get('clients/templates')
  async getClientTemplates(@Req() request: HeaderAccessibleRequest) {
    const auth = await this.clientAuthService.authenticate(request);
    return this.templateService.getClientAvailableTemplates(auth.clientAppId);
  }
}
