import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientApiKeyEntity, ClientAppEntity } from '@app/database';
import { AdminApiController } from './admin-api.controller';
import { AdminApiService } from './admin-api.service';
import { ClientApiKeyModule } from './modules/client-api-key/client-api-key.module';

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
      entities: [ClientAppEntity, ClientApiKeyEntity],
      synchronize: false,
      logging: false,
    }),
    ClientApiKeyModule,
  ],
  controllers: [AdminApiController],
  providers: [AdminApiService],
})
export class AdminApiModule { }
