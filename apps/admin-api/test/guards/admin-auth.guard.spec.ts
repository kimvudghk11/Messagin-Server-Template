import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyStatus, ApiKeyType, ClientApiKeyEntity, ClientAppEntity, ClientAppStatus } from '@app/database';
import { makeHttpExecutionContext } from '@app/common/testing';
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

  it('throws when x-api-key header is missing', async () => {
    await expect(guard.canActivate(makeContext(undefined, PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('Missing API key headers'),
    );
  });

  it('throws when x-api-secret header is missing', async () => {
    await expect(guard.canActivate(makeContext('mst_live_admin123', undefined))).rejects.toThrow(
      new UnauthorizedException('Missing API key headers'),
    );
  });

  it('throws when key not found', async () => {
    apiKeyRepo.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext('unknown', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('Invalid API key'),
    );
  });

  it('throws when key type is SERVER (not ADMIN)', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ keyType: ApiKeyType.SERVER }));

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('Admin access required'),
    );
  });

  it('throws when key type is WORKER (not ADMIN)', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ keyType: ApiKeyType.WORKER }));

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('Admin access required'),
    );
  });

  it('throws when key is revoked', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ status: ApiKeyStatus.REVOKED }));

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('API key is not active'),
    );
  });

  it('throws when key is expired', async () => {
    const expiredAt = new Date(Date.now() - 1000);
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ expiredAt }));

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('API key expired'),
    );
  });

  it('passes when key has future expiry', async () => {
    const expiredAt = new Date(Date.now() + 60_000);
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ expiredAt }));
    apiKeyRepo.save.mockResolvedValue({});
    appRepo.findOne.mockResolvedValue(makeClientApp());

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).resolves.toBe(true);
  });

  it('throws when secret is wrong', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());

    await expect(guard.canActivate(makeContext('mst_live_admin123', 'wrong-secret'))).rejects.toThrow(
      new UnauthorizedException('Invalid API secret'),
    );
  });

  it('throws when client app is inactive', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    appRepo.findOne.mockResolvedValue(makeClientApp({ status: ClientAppStatus.INACTIVE }));

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('Client app is not active'),
    );
  });

  it('throws when client app is not found', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    appRepo.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext('mst_live_admin123', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('Client app is not active'),
    );
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
