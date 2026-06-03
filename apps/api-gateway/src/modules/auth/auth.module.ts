import { ClientApiKeyEntity, ClientAppEntity, ClientIpWhitelistEntity } from '@app/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientAuthService } from './client-auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientApiKeyEntity, ClientAppEntity, ClientIpWhitelistEntity])],
  providers: [ClientAuthService],
  exports: [ClientAuthService],
})
export class AuthModule { }
