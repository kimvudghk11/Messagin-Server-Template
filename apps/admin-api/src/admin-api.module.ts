import { APP_INTERCEPTOR, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientApiKeyEntity, ClientAppEntity } from '@app/database';
import { HttpMetricsInterceptor, MetricsModule } from '@app/common';
import { AdminApiController } from './admin-api.controller';
import { AdminApiService } from './admin-api.service';
import { ClientApiKeyModule } from './modules/client-api-key/client-api-key.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'messaging',
      entities: [ClientAppEntity, ClientApiKeyEntity],
      synchronize: false,
      logging: false,
    }),
    ClientApiKeyModule,
    MetricsModule,
  ],
  controllers: [AdminApiController],
  providers: [
    AdminApiService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AdminApiModule { }
