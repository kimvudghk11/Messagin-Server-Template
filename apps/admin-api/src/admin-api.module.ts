import { APP_INTERCEPTOR, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientApiKeyEntity, ClientAppEntity, createTypeOrmConfig } from '@app/database';
import { HttpMetricsInterceptor, MetricsModule } from '@app/common';
import { AdminApiController } from './admin-api.controller';
import { AdminApiService } from './admin-api.service';
import { ClientApiKeyModule } from './modules/client-api-key/client-api-key.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    TypeOrmModule.forRoot(createTypeOrmConfig([ClientAppEntity, ClientApiKeyEntity])),
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
