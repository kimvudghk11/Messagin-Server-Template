import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import {
  ApiKeyStatus,
  ApiKeyType,
  ClientApiKeyEntity,
  ClientAppEntity,
  ClientAppStatus,
  ClientIpWhitelistEntity,
} from '@app/database';
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
    isIpWhitelistEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ClientAppEntity;
}

function makeRequest(keyId?: string, secret?: string, ip?: string) {
  return {
    header: (name: string) => {
      if (name === 'x-api-key') return keyId;
      if (name === 'x-api-secret') return secret;
      return undefined;
    },
    ip,
  };
}

describe('ClientAuthService', () => {
  let service: ClientAuthService;
  let apiKeyRepo: { findOne: jest.Mock; save: jest.Mock };
  let appRepo: { findOne: jest.Mock };
  let ipWhitelistRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    apiKeyRepo = { findOne: jest.fn(), save: jest.fn() };
    appRepo = { findOne: jest.fn() };
    ipWhitelistRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientAuthService,
        { provide: getRepositoryToken(ClientApiKeyEntity), useValue: apiKeyRepo },
        { provide: getRepositoryToken(ClientAppEntity), useValue: appRepo },
        { provide: getRepositoryToken(ClientIpWhitelistEntity), useValue: ipWhitelistRepo },
      ],
    }).compile();

    service = module.get(ClientAuthService);
  });

  it('returns authenticated client with keyType for valid credentials', async () => {
    apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
    apiKeyRepo.save.mockResolvedValue({});
    appRepo.findOne.mockResolvedValue(makeClientApp());

    const result = await service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET));

    expect(result).toEqual({
      clientAppId: 'app-id-uuid',
      appCode: 'my-app',
      apiKeyId: 'key-id-uuid',
      keyType: ApiKeyType.SERVER,
    });
  });

  it('updates lastUsedAt after successful authentication', async () => {
    const apiKey = makeApiKey();
    apiKeyRepo.findOne.mockResolvedValue(apiKey);
    apiKeyRepo.save.mockResolvedValue({});
    appRepo.findOne.mockResolvedValue(makeClientApp());

    await service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET));

    expect(apiKeyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ lastUsedAt: expect.any(Date) }));
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
    apiKeyRepo.save.mockResolvedValue({});
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

  describe('IP whitelist', () => {
    it('skips IP check when isIpWhitelistEnabled is false', async () => {
      apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
      apiKeyRepo.save.mockResolvedValue({});
      appRepo.findOne.mockResolvedValue(makeClientApp({ isIpWhitelistEnabled: false }));

      await expect(service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET, '1.2.3.4'))).resolves.toBeDefined();
      expect(ipWhitelistRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('throws when IP not in whitelist', async () => {
      apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
      appRepo.findOne.mockResolvedValue(makeClientApp({ isIpWhitelistEnabled: true }));

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      ipWhitelistRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET, '9.9.9.9'))).rejects.toThrow(
        new UnauthorizedException('IP address not allowed'),
      );
    });

    it('passes when IP matches whitelist entry', async () => {
      apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
      apiKeyRepo.save.mockResolvedValue({});
      appRepo.findOne.mockResolvedValue(makeClientApp({ isIpWhitelistEnabled: true }));

      const allowedEntry = { id: 'wl-uuid', ipAddress: '10.0.0.0/8' } as ClientIpWhitelistEntity;
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(allowedEntry),
      };
      ipWhitelistRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET, '10.1.2.3'))).resolves.toBeDefined();
    });

    it('uses X-Forwarded-For header as client IP', async () => {
      apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
      apiKeyRepo.save.mockResolvedValue({});
      appRepo.findOne.mockResolvedValue(makeClientApp({ isIpWhitelistEnabled: true }));

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'wl-uuid' } as ClientIpWhitelistEntity),
      };
      ipWhitelistRepo.createQueryBuilder.mockReturnValue(qb);

      const request = {
        header: (name: string) => {
          if (name === 'x-api-key') return 'mst_test_abc123';
          if (name === 'x-api-secret') return PLAIN_SECRET;
          if (name === 'x-forwarded-for') return '203.0.113.5, 10.0.0.1';
          return undefined;
        },
        ip: '10.0.0.1',
      };

      await service.authenticate(request);

      // Should use first entry from X-Forwarded-For (203.0.113.5), not socket IP
      expect(qb.andWhere).toHaveBeenCalledWith(':ip::inet << wl.ip_address', { ip: '203.0.113.5' });
    });
  });
});
