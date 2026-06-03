import { DynamicModule, Module } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Module({})
export class RedisModule {
  static forRoot(): DynamicModule {
    const redisProvider = {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
      },
    };

    return {
      module: RedisModule,
      providers: [redisProvider],
      exports: [redisProvider],
      global: true,
    };
  }
}
