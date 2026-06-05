import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppException, ErrorCode } from '@app/common';
import {
  ClientTemplateAccessEntity,
  MessageTemplateEntity,
  MessageTemplateVariableEntity,
  TemplateAccessScope,
  TemplateCategory,
  TemplateVariableDataType,
} from '@app/database';
import { TemplateService } from '../../../src/modules/template/template.service';

function makeTemplate(overrides: Partial<MessageTemplateEntity> = {}): MessageTemplateEntity {
  return {
    id: 'tpl-uuid',
    templateCode: 'WELCOME',
    templateName: 'Welcome',
    category: TemplateCategory.SYSTEM,
    description: null,
    accessScope: TemplateAccessScope.PUBLIC,
    isActive: true,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as MessageTemplateEntity;
}

function makeVariable(variableKey: string): MessageTemplateVariableEntity {
  return {
    id: 'var-uuid',
    templateId: 'tpl-uuid',
    variableKey,
    dataType: TemplateVariableDataType.STRING,
    isRequired: true,
    displayOrder: 1,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as MessageTemplateVariableEntity;
}

function makeAccess(templateId: string, clientAppId: string): ClientTemplateAccessEntity {
  return {
    id: 'access-uuid',
    templateId,
    clientAppId,
    isAllowed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ClientTemplateAccessEntity;
}

describe('TemplateService', () => {
  let service: TemplateService;
  let templateRepo: { findOne: jest.Mock; find: jest.Mock; createQueryBuilder: jest.Mock };
  let variableRepo: { find: jest.Mock };
  let accessRepo: { findOne: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    templateRepo = { findOne: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() };
    variableRepo = { find: jest.fn() };
    accessRepo = { findOne: jest.fn(), find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        { provide: getRepositoryToken(MessageTemplateEntity), useValue: templateRepo },
        { provide: getRepositoryToken(MessageTemplateVariableEntity), useValue: variableRepo },
        { provide: getRepositoryToken(ClientTemplateAccessEntity), useValue: accessRepo },
      ],
    }).compile();

    service = module.get(TemplateService);
  });

  describe('getTemplateByCode', () => {
    it('returns template for PUBLIC scope without access check', async () => {
      const template = makeTemplate({ accessScope: TemplateAccessScope.PUBLIC });
      templateRepo.findOne.mockResolvedValue(template);

      const result = await service.getTemplateByCode('WELCOME', 'app-uuid');

      expect(result).toBe(template);
      expect(accessRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws MSG_TEMPLATE_NOT_FOUND when template not found', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.getTemplateByCode('MISSING', 'app-uuid')).rejects.toMatchObject({
        errorCode: ErrorCode.MSG_TEMPLATE_NOT_FOUND,
      });
    });

    it('returns PRIVATE template when client has access', async () => {
      const template = makeTemplate({ accessScope: TemplateAccessScope.PRIVATE });
      templateRepo.findOne.mockResolvedValue(template);
      accessRepo.findOne.mockResolvedValue(makeAccess('tpl-uuid', 'app-uuid'));

      const result = await service.getTemplateByCode('WELCOME', 'app-uuid');

      expect(result).toBe(template);
    });

    it('throws MSG_TEMPLATE_NOT_FOUND for PRIVATE template without access', async () => {
      const template = makeTemplate({ accessScope: TemplateAccessScope.PRIVATE });
      templateRepo.findOne.mockResolvedValue(template);
      accessRepo.findOne.mockResolvedValue(null);

      await expect(service.getTemplateByCode('WELCOME', 'app-uuid')).rejects.toMatchObject({
        errorCode: ErrorCode.MSG_TEMPLATE_NOT_FOUND,
      });
    });

    it('throws MSG_TEMPLATE_NOT_FOUND for RESTRICTED template without access', async () => {
      const template = makeTemplate({ accessScope: TemplateAccessScope.RESTRICTED });
      templateRepo.findOne.mockResolvedValue(template);
      accessRepo.findOne.mockResolvedValue(null);

      await expect(service.getTemplateByCode('WELCOME', 'app-uuid')).rejects.toMatchObject({
        errorCode: ErrorCode.MSG_TEMPLATE_NOT_FOUND,
      });
    });
  });

  describe('getVariablesByTemplateId', () => {
    it('returns variables ordered by displayOrder', async () => {
      const variables = [makeVariable('name'), makeVariable('amount')];
      variableRepo.find.mockResolvedValue(variables);

      const result = await service.getVariablesByTemplateId('tpl-uuid');

      expect(result).toBe(variables);
      expect(variableRepo.find).toHaveBeenCalledWith({
        where: { templateId: 'tpl-uuid' },
        order: { displayOrder: 'ASC' },
      });
    });
  });

  describe('getClientAvailableTemplates', () => {
    it('returns only PUBLIC templates when client has no access records', async () => {
      accessRepo.find.mockResolvedValue([]);
      const publicTemplates = [makeTemplate()];
      templateRepo.find.mockResolvedValue(publicTemplates);

      const result = await service.getClientAvailableTemplates('app-uuid');

      expect(result).toBe(publicTemplates);
      expect(templateRepo.find).toHaveBeenCalledWith({
        where: { accessScope: TemplateAccessScope.PUBLIC, isActive: true },
      });
    });

    it('returns PUBLIC + granted templates when client has access records', async () => {
      accessRepo.find.mockResolvedValue([makeAccess('tpl-uuid', 'app-uuid')]);
      const templates = [makeTemplate(), makeTemplate({ id: 'tpl-uuid-2', accessScope: TemplateAccessScope.PRIVATE })];

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(templates),
      };
      templateRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getClientAvailableTemplates('app-uuid');

      expect(result).toBe(templates);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('templateIds'),
        expect.objectContaining({ templateIds: ['tpl-uuid'] }),
      );
    });
  });
});
