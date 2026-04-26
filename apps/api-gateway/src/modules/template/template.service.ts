import {
  ClientTemplateAccessEntity,
  MessageTemplateEntity,
  MessageTemplateVariableEntity,
  TemplateAccessScope,
} from '@app/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(MessageTemplateEntity)
    private readonly templateRepository: Repository<MessageTemplateEntity>,
    @InjectRepository(MessageTemplateVariableEntity)
    private readonly templateVariableRepository: Repository<MessageTemplateVariableEntity>,
    @InjectRepository(ClientTemplateAccessEntity)
    private readonly clientTemplateAccessRepository: Repository<ClientTemplateAccessEntity>,
  ) { }

  async getTemplateByCode(templateCode: string, clientAppId: string) {
    const template = await this.templateRepository.findOne({
      where: { templateCode, isActive: true },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.assertTemplateAccessible(template.id, template.accessScope, clientAppId);

    return template;
  }

  async getTemplateVariables(templateCode: string, clientAppId: string) {
    const template = await this.getTemplateByCode(templateCode, clientAppId);

    return this.templateVariableRepository.find({
      where: { templateId: template.id },
      order: { displayOrder: 'ASC' },
    });
  }

  async getClientAvailableTemplates(clientAppId: string) {
    const accesses = await this.clientTemplateAccessRepository.find({
      where: { clientAppId, isAllowed: true },
    });

    if (accesses.length === 0) {
      return this.templateRepository.find({ where: { accessScope: TemplateAccessScope.PUBLIC, isActive: true } });
    }

    const templateIds = accesses.map((item) => item.templateId);
    return this.templateRepository
      .createQueryBuilder('template')
      .where('template.is_active = true')
      .andWhere('(template.access_scope = :publicScope OR template.id IN (:...templateIds))', {
        publicScope: TemplateAccessScope.PUBLIC,
        templateIds,
      })
      .getMany();
  }

  private async assertTemplateAccessible(
    templateId: string,
    accessScope: TemplateAccessScope,
    clientAppId: string,
  ) {
    if (accessScope === TemplateAccessScope.PUBLIC) {
      return;
    }

    const access = await this.clientTemplateAccessRepository.findOne({
      where: {
        templateId,
        clientAppId,
        isAllowed: true,
      },
    });

    if (!access) {
      throw new NotFoundException('Template not found');
    }
  }
}
