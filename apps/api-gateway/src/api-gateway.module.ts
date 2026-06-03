import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  ClientApiKeyEntity,
  ClientAppEntity,
  ClientIpWhitelistEntity,
  ClientPermissionEntity,
  ClientTemplateAccessEntity,
  MessageOutboxEntity,
  MessagePayloadEntity,
  MessageRecipientEntity,
  MessageRequestEntity,
  MessageTemplateEntity,
  MessageTemplateVariableEntity,
} from '@app/database';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '@app/kafka';
import { RequestIdMiddleware } from '@app/common';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { AuthModule } from './modules/auth/auth.module';
import { MessageRequestModule } from './modules/message-request/message-request.module';
import { TemplateModule } from './modules/template/template.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'messaging',
      entities: [
        ClientAppEntity,
        ClientApiKeyEntity,
        ClientIpWhitelistEntity,
        ClientPermissionEntity,
        MessageTemplateEntity,
        MessageTemplateVariableEntity,
        ClientTemplateAccessEntity,
        MessageRequestEntity,
        MessageRecipientEntity,
        MessagePayloadEntity,
        MessageOutboxEntity,
      ],
      synchronize: false,
      logging: false,
    }),
    KafkaModule,
    AuthModule,
    TemplateModule,
    MessageRequestModule,
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
