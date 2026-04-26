import {
  ClientTemplateAccessEntity,
  MessageTemplateEntity,
  MessageTemplateVariableEntity,
} from '@app/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      MessageTemplateEntity,
      MessageTemplateVariableEntity,
      ClientTemplateAccessEntity,
    ]),
  ],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule { }
