import { Test, TestingModule } from '@nestjs/testing';
import { DlqController } from '../../../src/modules/dlq/dlq.controller';
import { DlqService } from '../../../src/modules/dlq/dlq.service';
import { AdminAuthGuard } from '../../../src/guards/admin-auth.guard';

describe('DlqController', () => {
  let controller: DlqController;
  let dlqService: { findAll: jest.Mock };

  beforeEach(async () => {
    dlqService = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DlqController],
      providers: [{ provide: DlqService, useValue: dlqService }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DlqController);
  });

  it('findAll returns paginated DLQ entries', async () => {
    const mockResult = { data: [], total: 0, page: 1, limit: 20 };
    dlqService.findAll.mockResolvedValue(mockResult);

    const result = await controller.findAll('1', '20');

    expect(dlqService.findAll).toHaveBeenCalledWith(1, 20);
    expect(result).toEqual(mockResult);
  });

  it('clamps limit to 100 maximum', async () => {
    dlqService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });

    await controller.findAll('1', '999');

    expect(dlqService.findAll).toHaveBeenCalledWith(1, 100);
  });

  it('uses default page 1 and limit 20 when not provided', async () => {
    dlqService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    await controller.findAll('1', '20');

    expect(dlqService.findAll).toHaveBeenCalledWith(1, 20);
  });
});
