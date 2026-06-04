import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuditLogController } from '../../../src/modules/audit-log/admin-audit-log.controller';
import { AdminAuditLogService } from '../../../src/modules/audit-log/admin-audit-log.service';
import { AdminAuthGuard } from '../../../src/guards/admin-auth.guard';

describe('AdminAuditLogController', () => {
  let controller: AdminAuditLogController;
  let auditLogService: { findAll: jest.Mock };

  beforeEach(async () => {
    auditLogService = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditLogController],
      providers: [{ provide: AdminAuditLogService, useValue: auditLogService }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminAuditLogController);
  });

  it('findAll returns paginated audit log entries', async () => {
    const mockResult = { data: [], total: 0, page: 1, limit: 20 };
    auditLogService.findAll.mockResolvedValue(mockResult);

    const result = await controller.findAll('1', '20');

    expect(auditLogService.findAll).toHaveBeenCalledWith(1, 20);
    expect(result).toEqual(mockResult);
  });

  it('clamps limit to 100 maximum', async () => {
    auditLogService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });

    await controller.findAll('1', '999');

    expect(auditLogService.findAll).toHaveBeenCalledWith(1, 100);
  });

  it('uses default page 1 and limit 20', async () => {
    auditLogService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    await controller.findAll('1', '20');

    expect(auditLogService.findAll).toHaveBeenCalledWith(1, 20);
  });
});
