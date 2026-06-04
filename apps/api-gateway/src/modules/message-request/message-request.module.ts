import { ClientPermissionEntity, MessageOutboxEntity, MessagePayloadEntity, MessageRecipientEntity, MessageRequestEntity } from '@app/database';
import { KafkaModule } from '@app/kafka';
import { PayloadCryptoModule } from '@app/common';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TemplateModule } from '../template/template.module';
import { ClientAuthGuard } from '../../guards/client-auth.guard';
import { ClientPermissionGuard } from '../../guards/client-permission.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';
import { MessageRequestController } from './message-request.controller';
import { MessageRequestService } from './message-request.service';
import { TemplateVariableValidator } from './validator/template-variable.validator';

@Module({
  imports: [
    AuthModule,
    TemplateModule,
    KafkaModule,
    PayloadCryptoModule,
    TypeOrmModule.forFeature([
      MessageRequestEntity,
      MessagePayloadEntity,
      MessageRecipientEntity,
      MessageOutboxEntity,
      ClientPermissionEntity,
    ]),
  ],
  controllers: [MessageRequestController],
  providers: [
    MessageRequestService,
    TemplateVariableValidator,
    ClientAuthGuard,
    ClientPermissionGuard,
    RateLimitGuard,
  ],
})
export class MessageRequestModule { }
