import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RequestWithClient } from './client-auth.guard';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithClient>();
    const { clientAppId, rateLimitPerMinute } = request.client;

    const now = Date.now();
    const windowStart = now - 60_000;

    const timestamps = (this.windows.get(clientAppId) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= rateLimitPerMinute) {
      throw new HttpException(
        `Rate limit exceeded: max ${rateLimitPerMinute} requests per minute`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
    this.windows.set(clientAppId, timestamps);
    return true;
  }
}
