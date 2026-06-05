import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AppException, ErrorCode, REDIS_CLIENT } from '@app/common';
import { RequestWithClient } from './client-auth.guard';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithClient>();
    const { clientAppId, rateLimitPerMinute } = request.client;

    const now = Date.now();
    const windowStart = now - 60_000;
    const key = `ratelimit:${clientAppId}`;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, 60);
    const results = await pipeline.exec();

    const count = (results?.[2]?.[1] as number | null) ?? 0;

    if (count > rateLimitPerMinute) {
      throw new AppException(ErrorCode.RATE_LIMIT_EXCEEDED, 429);
    }

    return true;
  }
}
