import { MessagePayloadEntity, MessageRequestEntity } from '@app/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TemplateModule } from '../template/template.module';
import { MessageRequestController } from './message-request.controller';
import { MessageRequestService } from './message-request.service';
import { TemplateVariableValidator } from './validator/template-variable.validator';

@Module({
  imports: [AuthModule, TemplateModule, TypeOrmModule.forFeature([MessageRequestEntity, MessagePayloadEntity])],
  controllers: [MessageRequestController],
  providers: [MessageRequestService, TemplateVariableValidator],
})
export class MessageRequestModule { }
