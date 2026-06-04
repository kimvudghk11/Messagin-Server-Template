import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminActionType, AdminAuditLogEntity, AdminTargetType } from '@app/database';

export interface AuditLogParams {
  adminKeyId: string;
  actionType: AdminActionType;
  targetType: AdminTargetType;
  targetId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AdminAuditLogService {
  constructor(
    @InjectRepository(AdminAuditLogEntity)
    private readonly auditLogRepository: Repository<AdminAuditLogEntity>,
  ) {}

  async log(params: AuditLogParams): Promise<void> {
    const entry = this.auditLogRepository.create({
      adminUserId: params.adminKeyId,
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      beforeData: params.beforeData ?? null,
      afterData: params.afterData ?? null,
      ipAddress: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    });
    await this.auditLogRepository.save(entry);
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<{ data: AdminAuditLogEntity[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.auditLogRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }
}
