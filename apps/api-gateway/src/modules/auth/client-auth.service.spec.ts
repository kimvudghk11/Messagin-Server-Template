import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyStatus, ApiKeyType, ClientApiKeyEntity, ClientAppEntity, ClientAppStatus } from '@app/database';
import { ClientAuthService } from './client-auth.service';

const PLAIN_SECRET = 'test-plain-secret-32-bytes-xxxx';
const SECRET_HASH = createHash('sha256').update(PLAIN_SECRET).digest('hex');

function makeApiKey(overrides: Partial<ClientApiKeyEntity> = {}): ClientApiKeyEntity {
  return {
    id: 'key-id-uuid',
    clientAppId: 'app-id-uuid',
    keyId: 'mst_test_abc123',
    keyName: 'test key',
    keyType: ApiKeyType.SERVER,
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
    id: 'app-id-uuid',
    appCode: 'my-app',
    status: ClientAppStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ClientAppEntity;
}

function makeRequest(keyId?: string, secret?: string) {
  return {
    header: (name: string) => {
      if (name === 'x-api-key') return keyId;
      if (name === 'x-api-secret') return secret;
      return undefined;
    },
  };
}

describe('ClientAuthService', () => {
  let service: ClientAuthService;
  let apiKeyRepo: { findOne: jest.Mock };
  let appRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    apiKeyRepo = { findOne: jest.fn() };
    appRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientAuthService,
        { provide: getRepositoryToken(ClientApiKeyEntity), useValue: apiKeyRepo },
        { provide: getRepositoryToken(ClientAppEntity), useValue: appRepo },
      ],
    }).compile();

    service = module.get(ClientAuthService);
  });

  it('returns authenticated client for valid credentials', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    appRepo.findOne.mockResolvedValue(makeClientApp());

    const result = await service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET));

    expect(result).toEqual({ clientAppId: 'app-id-uuid', appCode: 'my-app', apiKeyId: 'key-id-uuid' });
  });

  it('throws when x-api-key header is missing', async () => {
    await expect(service.authenticate(makeRequest(undefined, PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('Missing API key headers'),
    );
  });

  it('throws when x-api-secret header is missing', async () => {
    await expect(service.authenticate(makeRequest('mst_test_abc123', undefined))).rejects.toThrow(
      new UnauthorizedException('Missing API key headers'),
    );
  });

  it('throws when API key not found', async () => {
    apiKeyRepo.findOne.mockResolvedValue(null);

    await expect(service.authenticate(makeRequest('unknown', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('Invalid API key'),
    );
  });

  it('throws when API key is revoked', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ status: ApiKeyStatus.REVOKED }));

    await expect(service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('API key is not active'),
    );
  });

  it('throws when API key is expired', async () => {
    const expiredAt = new Date(Date.now() - 1000);
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ expiredAt }));

    await expect(service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('API key expired'),
    );
  });

  it('passes when API key has future expiry', async () => {
    const expiredAt = new Date(Date.now() + 60_000);
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ expiredAt }));
    appRepo.findOne.mockResolvedValue(makeClientApp());

    await expect(service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET))).resolves.toBeDefined();
  });

  it('throws when secret hash does not match', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());

    await expect(service.authenticate(makeRequest('mst_test_abc123', 'wrong-secret'))).rejects.toThrow(
      new UnauthorizedException('Invalid API secret'),
    );
  });

  it('throws when client app is inactive', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    appRepo.findOne.mockResolvedValue(makeClientApp({ status: ClientAppStatus.INACTIVE }));

    await expect(service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('Client app is not active'),
    );
  });

  it('throws when client app is not found', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    appRepo.findOne.mockResolvedValue(null);

    await expect(service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET))).rejects.toThrow(
      new UnauthorizedException('Client app is not active'),
    );
  });
});
