import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { makeHttpExecutionContext } from '@app/common/testing';
import { RateLimitGuard } from './rate-limit.guard';
import { ApiKeyType } from '@app/database';
import { AuthenticatedClient } from '../modules/auth/client-auth.service';

function makeContext(clientAppId: string, rateLimitPerMinute: number): ExecutionContext {
  const client: AuthenticatedClient = {
    clientAppId,
    rateLimitPerMinute,
    appCode: 'app',
    apiKeyId: 'key',
    keyType: ApiKeyType.SERVER,
  };
  return makeHttpExecutionContext({ client });
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(() => {
    guard = new RateLimitGuard();
  });

  it('allows requests within the limit', () => {
    const ctx = makeContext('app-1', 3);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws TooManyRequestsException when limit exceeded', () => {
    const ctx = makeContext('app-2', 2);
    guard.canActivate(ctx);
    guard.canActivate(ctx);
    try {
      guard.canActivate(ctx);
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('tracks limits independently per clientAppId', () => {
    const ctx1 = makeContext('app-3', 1);
    const ctx2 = makeContext('app-4', 1);
    expect(guard.canActivate(ctx1)).toBe(true);
    expect(guard.canActivate(ctx2)).toBe(true);
    try {
      guard.canActivate(ctx1);
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});
