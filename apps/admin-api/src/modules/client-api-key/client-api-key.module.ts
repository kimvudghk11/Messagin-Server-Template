import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientApiKeyEntity, ClientAppEntity } from '@app/database';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { ClientApiKeyController } from './client-api-key.controller';
import { ClientApiKeyService } from './client-api-key.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientAppEntity, ClientApiKeyEntity])],
  controllers: [ClientApiKeyController],
  providers: [ClientApiKeyService, AdminAuthGuard],
})
export class ClientApiKeyModule { }
