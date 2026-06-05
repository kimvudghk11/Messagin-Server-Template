import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExecutionContext } from '@nestjs/common';
import { ApiKeyStatus, ApiKeyType, ClientApiKeyEntity, ClientAppEntity, ClientAppStatus } from '@app/database';
import { makeHttpExecutionContext } from '@app/common/testing';
import { AppException, ErrorCode } from '@app/common';
import { AdminAuthGuard } from '../../src/guards/admin-auth.guard';

const PLAIN_SECRET = 'admin-plain-secret-32-bytes-xxx';
const SECRET_HASH = createHash('sha256').update(PLAIN_SECRET).digest('hex');

function makeApiKey(overrides: Partial<ClientApiKeyEntity> = {}): ClientApiKeyEntity {
  return {
    id: 'admin-key-uuid',
    clientAppId: 'admin-app-uuid',
    keyId: 'mst_live_admin123',
    keyName: 'admin key',
    keyType: ApiKeyType.ADMIN,
    secretHash: SECRET_HASH,
    secretHint: 'xxxx',
    status: ApiKeyStatus.ACTIVE,
    issuedAt: new Date(),
    expiredAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ClientApiKeyEntity;
}

function makeClientApp(overrides: Partial<ClientAppEntity> = {}): ClientAppEntity {
  return {
    id: 'admin-app-uuid',
    appCode: 'admin-app',
    status: ClientAppStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ClientAppEntity;
}

function makeContext(keyId?: string, secret?: string): ExecutionContext {
  const request: Record<string, unknown> = {
    header: (name: string): string | undefined => {
      if (name === 'x-api-key') return keyId;
      if (name === 'x-api-secret') return secret;
      return undefined;
    },
  };
  return makeHttpExecutionContext(request);
}

describe('AdminAuthGuard', () => {
  let guard: AdminAuthGuard;
  let apiKeyRepo: { findOne: jest.Mock; save: jest.Mock };
  let appRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    apiKeyRepo = { findOne: jest.fn(), save: jest.fn() };
    appRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthGuard,
        { provide: getRepositoryToken(ClientApiKeyEntity), useValue: apiKeyRepo },
        { provide: getRepositoryToken(ClientAppEntity), useValue: appRepo },
      ],
    }).compile();

    guard = module.get(AdminAuthGuard);
  });

  it('returns true for valid admin key', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    apiKeyRepo.save.mockResolvedValue({});
    appRepo.findOne.mockResolvedValue(makeClientApp());

    const result = await guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET));

    expect(result).toBe(true);
  });

  it('updates lastUsedAt on success', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    apiKeyRepo.save.mockResolvedValue({});
    appRepo.findOne.mockResolvedValue(makeClientApp());

    await guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET));

    expect(apiKeyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ lastUsedAt: expect.any(Date) }),
    );
  });

  it('throws AUTH_MISSING_HEADERS when x-api-key header is missing', async () => {
    await expect(guard.canActivate(makeContext(undefined, PLAIN_SECRET))).rejects.toMatchObject({
      errorCode: ErrorCode.AUTH_MISSING_HEADERS,
    });
  });

  it('throws AUTH_MISSING_HEADERS when x-api-secret header is missing', async () => {
    await expect(guard.canActivate(makeContext('mst_live_admin123', undefined))).rejects.toMatchObject({
      errorCode: ErrorCode.AUTH_MISSING_HEADERS,
    });
  });

  it('throws AUTH_INVALID_API_KEY when key not found', async () => {
    apiKeyRepo.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext('unknown', PLAIN_SECRET))).rejects.toMatchObject({
      errorCode: ErrorCode.AUTH_INVALID_API_KEY,
    });
  });

  it('throws AUTH_ADMIN_REQUIRED when key type is SERVER', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ keyType: ApiKeyType.SERVER }));

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toMatchObject({
      errorCode: ErrorCode.AUTH_ADMIN_REQUIRED,
    });
  });

  it('throws AUTH_ADMIN_REQUIRED when key type is WORKER', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ keyType: ApiKeyType.WORKER }));

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toMatchObject({
      errorCode: ErrorCode.AUTH_ADMIN_REQUIRED,
    });
  });

  it('throws AUTH_API_KEY_INACTIVE when key is revoked', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ status: ApiKeyStatus.REVOKED }));

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toMatchObject({
      errorCode: ErrorCode.AUTH_API_KEY_INACTIVE,
    });
  });

  it('throws AUTH_API_KEY_EXPIRED when key is expired', async () => {
    const expiredAt = new Date(Date.now() - 1000);
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ expiredAt }));

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toMatchObject({
      errorCode: ErrorCode.AUTH_API_KEY_EXPIRED,
    });
  });

  it('passes when key has future expiry', async () => {
    const expiredAt = new Date(Date.now() + 60_000);
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ expiredAt }));
    apiKeyRepo.save.mockResolvedValue({});
    appRepo.findOne.mockResolvedValue(makeClientApp());

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).resolves.toBe(true);
  });

  it('throws AUTH_INVALID_SECRET when secret is wrong', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());

    await expect(guard.canActivate(makeContext('mst_live_admin123', 'wrong-secret'))).rejects.toMatchObject({
      errorCode: ErrorCode.AUTH_INVALID_SECRET,
    });
  });

  it('throws AUTH_CLIENT_APP_INACTIVE when client app is inactive', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    appRepo.findOne.mockResolvedValue(makeClientApp({ status: ClientAppStatus.INACTIVE }));

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toMatchObject({
      errorCode: ErrorCode.AUTH_CLIENT_APP_INACTIVE,
    });
  });

  it('throws AUTH_CLIENT_APP_INACTIVE when client app is not found', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    appRepo.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toMatchObject({
      errorCode: ErrorCode.AUTH_CLIENT_APP_INACTIVE,
    });
  });

  it('sets adminKeyId on request after successful auth', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    apiKeyRepo.save.mockResolvedValue({});
    appRepo.findOne.mockResolvedValue(makeClientApp());

    const request: Record<string, unknown> = {
      header: (name: string): string | undefined => {
        if (name === 'x-api-key') return 'mst_live_admin123';
        if (name === 'x-api-secret') return PLAIN_SECRET;
        return undefined;
      },
    };
    const ctx = makeHttpExecutionContext(request);

    await guard.canActivate(ctx);

    expect(request['adminKeyId']).toBe('admin-key-uuid');
  });
});
