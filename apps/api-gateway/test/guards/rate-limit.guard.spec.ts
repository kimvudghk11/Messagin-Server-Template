import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { makeHttpExecutionContext } from '@app/common/testing';
import { REDIS_CLIENT } from '@app/common';
import { RateLimitGuard } from '../../src/guards/rate-limit.guard';
import { ApiKeyType } from '@app/database';
import { AuthenticatedClient } from '../../src/modules/auth/client-auth.service';

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

function makeRedisMock(cardResult: number) {
  const pipeline = {
    zremrangebyscore: jest.fn().mockReturnThis(),
    zadd: jest.fn().mockReturnThis(),
    zcard: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
      [null, 0],
      [null, 0],
      [null, cardResult],
      [null, 1],
    ]),
  };
  return { pipeline: jest.fn().mockReturnValue(pipeline) };
}

describe('RateLimitGuard', () => {
  async function buildGuard(cardResult: number): Promise<RateLimitGuard> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        { provide: REDIS_CLIENT, useValue: makeRedisMock(cardResult) },
      ],
    }).compile();
    return module.get(RateLimitGuard);
  }

  it('allows request when count is within limit', async () => {
    const guard = await buildGuard(1);
    const ctx = makeContext('app-1', 3);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws TooManyRequestsException when count exceeds limit', async () => {
    const guard = await buildGuard(4);
    const ctx = makeContext('app-2', 3);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('allows exactly at the limit (count === limit)', async () => {
    const guard = await buildGuard(3);
    const ctx = makeContext('app-3', 3);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws when count is one over the limit', async () => {
    const guard = await buildGuard(4);
    const ctx = makeContext('app-4', 3);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });
});
