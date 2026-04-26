import { MessagePayloadEntity, MessageRecipientEntity, MessageRequestEntity } from '@app/database';
import { KafkaModule } from '@app/kafka';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TemplateModule } from '../template/template.module';
import { MessageRequestController } from './message-request.controller';
import { MessageRequestService } from './message-request.service';
import { TemplateVariableValidator } from './validator/template-variable.validator';

@Module({
  imports: [
    AuthModule,
    TemplateModule,
    KafkaModule,
    TypeOrmModule.forFeature([MessageRequestEntity, MessagePayloadEntity, MessageRecipientEntity]),
  ],
  controllers: [MessageRequestController],
  providers: [MessageRequestService, TemplateVariableValidator],
})
export class MessageRequestModule { }
