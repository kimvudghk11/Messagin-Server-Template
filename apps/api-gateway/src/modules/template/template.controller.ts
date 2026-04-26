import { Controller, Get, Param, Req } from '@nestjs/common';
import { ClientAuthService, HeaderAccessibleRequest } from '../auth/client-auth.service';
import { TemplateService } from './template.service';

@Controller()
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly clientAuthService: ClientAuthService,
  ) { }

  @Get('templates/:code')
  async getTemplateByCode(@Param('code') code: string, @Req() request: HeaderAccessibleRequest) {
    const auth = await this.clientAuthService.authenticate(request);
    return this.templateService.getTemplateByCode(code, auth.clientAppId);
  }

  @Get('templates/:code/variables')
  async getTemplateVariables(@Param('code') code: string, @Req() request: HeaderAccessibleRequest) {
    const auth = await this.clientAuthService.authenticate(request);
    return this.templateService.getTemplateVariables(code, auth.clientAppId);
  }

  @Get('clients/templates')
  async getClientTemplates(@Req() request: HeaderAccessibleRequest) {
    const auth = await this.clientAuthService.authenticate(request);
    return this.templateService.getClientAvailableTemplates(auth.clientAppId);
  }
}
