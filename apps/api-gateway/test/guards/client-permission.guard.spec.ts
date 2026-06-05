import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKeyType, ClientPermissionEntity, ClientPermissionType } from '@app/database';
import { makeHttpExecutionContext } from '@app/common/testing';
import { AppException, ErrorCode } from '@app/common';
import { ClientPermissionGuard } from '../../src/guards/client-permission.guard';
import { PERMISSION_KEY } from '../../src/decorators/require-permission.decorator';
import { AuthenticatedClient } from '../../src/modules/auth/client-auth.service';

function makeContext(clientAppId: string, handlerPermission?: ClientPermissionType): ExecutionContext {
  const client: AuthenticatedClient = {
    clientAppId,
    appCode: 'app',
    apiKeyId: 'key',
    keyType: ApiKeyType.SERVER,
    rateLimitPerMinute: 60,
  };
  return makeHttpExecutionContext(
    { client },
    { [PERMISSION_KEY]: handlerPermission },
  );
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

    jest.spyOn(reflector, 'get').mockImplementation((key: unknown, handler: unknown) => {
      return (handler as Record<string, unknown>)[key as string];
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

  it('throws PERM_INSUFFICIENT when permission not found', async () => {
    permRepo.findOne.mockResolvedValue(null);
    const ctx = makeContext('app-1', ClientPermissionType.SEND_MESSAGE);

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      errorCode: ErrorCode.PERM_INSUFFICIENT,
    });
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
