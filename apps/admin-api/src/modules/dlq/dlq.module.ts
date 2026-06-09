import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientApiKeyEntity, ClientAppEntity, MessageDlqEntity } from '@app/database';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { DlqController } from './dlq.controller';
import { DlqService } from './dlq.service';

@Module({
  imports: [TypeOrmModule.forFeature([MessageDlqEntity, ClientAppEntity, ClientApiKeyEntity])],
  controllers: [DlqController],
  providers: [DlqService, AdminAuthGuard],
})
export class DlqModule {}
