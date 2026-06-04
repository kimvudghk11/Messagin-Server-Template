import { APP_INTERCEPTOR, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { ClsModule } from 'nestjs-cls';
import { HttpMetricsInterceptor, MetricsModule, RedisModule } from '@app/common';
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
  createTypeOrmConfig,
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
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().default('postgres'),
        DB_PASSWORD: Joi.string().default('postgres'),
        DB_NAME: Joi.string().default('messaging'),
        KAFKA_BROKERS: Joi.string().default('localhost:9092'),
        KAFKA_CLIENT_ID: Joi.string().default('messaging-api-gateway'),
        REDIS_URL: Joi.string().default('redis://localhost:6379'),
        PAYLOAD_ENCRYPTION_KEY: Joi.string().required(),
      }),
      validationOptions: { allowUnknown: true },
    }),
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    RedisModule.forRoot(),
    MetricsModule,
    TypeOrmModule.forRoot(createTypeOrmConfig([
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
    ])),
    KafkaModule,
    AuthModule,
    TemplateModule,
    MessageRequestModule,
  ],
  controllers: [ApiGatewayController],
  providers: [
    ApiGatewayService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
