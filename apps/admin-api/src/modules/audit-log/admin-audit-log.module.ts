import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLogEntity, ClientApiKeyEntity, ClientAppEntity } from '@app/database';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { AdminAuditLogController } from './admin-audit-log.controller';
import { AdminAuditLogService } from './admin-audit-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAuditLogEntity, ClientAppEntity, ClientApiKeyEntity])],
  controllers: [AdminAuditLogController],
  providers: [AdminAuditLogService, AdminAuthGuard],
  exports: [AdminAuditLogService],
})
export class AdminAuditLogModule {}
