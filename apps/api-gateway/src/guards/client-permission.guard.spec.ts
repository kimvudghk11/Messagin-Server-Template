import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKeyType, ClientPermissionEntity, ClientPermissionType } from '@app/database';
import { ClientPermissionGuard } from './client-permission.guard';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

function makeContext(clientAppId: string, handlerPermission?: ClientPermissionType): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ client: { clientAppId, appCode: 'app', apiKeyId: 'key', keyType: ApiKeyType.SERVER, rateLimitPerMinute: 60 } as any }),
    }),
    getHandler: () => ({ [PERMISSION_KEY]: handlerPermission }),
  } as unknown as ExecutionContext;
}

describe('ClientPermissionGuard', () => {
  let guard: ClientPermissionGuard;
  let permRepo: { findOne: jest.Mock };
  let reflector: Reflector;

  beforeEach(async () => {
    permRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientPermissionGuard,
        Reflector,
        { provide: getRepositoryToken(ClientPermissionEntity), useValue: permRepo },
      ],
    }).compile();

    guard = module.get(ClientPermissionGuard);
    reflector = module.get(Reflector);

    jest.spyOn(reflector, 'get').mockImplementation((key, handler) => {
      return (handler as unknown as Record<string, unknown>)[key as string];
    });
  });

  it('returns true when no permission is required', async () => {
    const ctx = makeContext('app-1', undefined);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(permRepo.findOne).not.toHaveBeenCalled();
  });

  it('returns true when client has the required permission', async () => {
    permRepo.findOne.mockResolvedValue({ id: 'perm-1', isAllowed: true } as ClientPermissionEntity);
    const ctx = makeContext('app-1', ClientPermissionType.SEND_MESSAGE);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when permission not found', async () => {
    permRepo.findOne.mockResolvedValue(null);
    const ctx = makeContext('app-1', ClientPermissionType.SEND_MESSAGE);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('queries with correct clientAppId and permissionType', async () => {
    permRepo.findOne.mockResolvedValue({ id: 'perm-1' } as ClientPermissionEntity);
    const ctx = makeContext('my-app-id', ClientPermissionType.SEND_MESSAGE);

    await guard.canActivate(ctx);

    expect(permRepo.findOne).toHaveBeenCalledWith({
      where: { clientAppId: 'my-app-id', permissionType: ClientPermissionType.SEND_MESSAGE, isAllowed: true },
    });
  });
});
