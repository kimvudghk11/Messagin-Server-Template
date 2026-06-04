import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminActionType, AdminAuditLogEntity, AdminTargetType } from '@app/database';
import { AdminAuditLogService } from '../../../src/modules/audit-log/admin-audit-log.service';

describe('AdminAuditLogService', () => {
  let service: AdminAuditLogService;
  let auditLogRepo: { create: jest.Mock; save: jest.Mock; findAndCount: jest.Mock };

  beforeEach(async () => {
    auditLogRepo = { create: jest.fn(), save: jest.fn(), findAndCount: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditLogService,
        { provide: getRepositoryToken(AdminAuditLogEntity), useValue: auditLogRepo },
      ],
    }).compile();

    service = module.get(AdminAuditLogService);
  });

  describe('log', () => {
    it('saves audit log entry with all required fields', async () => {
      auditLogRepo.create.mockReturnValue({ id: 'log-uuid' });
      auditLogRepo.save.mockResolvedValue({ id: 'log-uuid' });

      await service.log({
        adminKeyId: 'admin-key-uuid',
        actionType: AdminActionType.CREATE_API_KEY,
        targetType: AdminTargetType.API_KEY,
        targetId: 'new-key-uuid',
        afterData: { keyId: 'mst_test_abc', keyName: 'test key', keyType: 'SERVER' },
        ip: '127.0.0.1',
        userAgent: 'curl/7.79.1',
      });

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-key-uuid',
          actionType: AdminActionType.CREATE_API_KEY,
          targetType: AdminTargetType.API_KEY,
          targetId: 'new-key-uuid',
          beforeData: null,
          afterData: { keyId: 'mst_test_abc', keyName: 'test key', keyType: 'SERVER' },
          ipAddress: '127.0.0.1',
          userAgent: 'curl/7.79.1',
        }),
      );
      expect(auditLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('uses null for optional fields when not provided', async () => {
      auditLogRepo.create.mockReturnValue({ id: 'log-uuid' });
      auditLogRepo.save.mockResolvedValue({ id: 'log-uuid' });

      await service.log({
        adminKeyId: 'admin-key-uuid',
        actionType: AdminActionType.CREATE_API_KEY,
        targetType: AdminTargetType.API_KEY,
      });

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: null,
          beforeData: null,
          afterData: null,
          ipAddress: null,
          userAgent: null,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated audit log entries', async () => {
      const mockEntry = { id: 'log-uuid' } as AdminAuditLogEntity;
      auditLogRepo.findAndCount.mockResolvedValue([[mockEntry], 1]);

      const result = await service.findAll(1, 20);

      expect(auditLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toEqual({ data: [mockEntry], total: 1, page: 1, limit: 20 });
    });

    it('calculates correct skip for page 2', async () => {
      auditLogRepo.findAndCount.mockResolvedValue([[], 50]);

      await service.findAll(2, 10);

      expect(auditLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });
});
