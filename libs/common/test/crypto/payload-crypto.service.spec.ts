import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PayloadCryptoService } from '../../src/crypto/payload-crypto.service';

const VALID_KEY = Buffer.alloc(32, 'k').toString('base64');

async function buildService(key: string | undefined = VALID_KEY): Promise<PayloadCryptoService> {
  const module = await Test.createTestingModule({
    providers: [
      PayloadCryptoService,
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockReturnValue(key) },
      },
    ],
  }).compile();
  const svc = module.get(PayloadCryptoService);
  svc.onModuleInit();
  return svc;
}

describe('PayloadCryptoService', () => {
  let service: PayloadCryptoService;

  beforeEach(async () => {
    service = await buildService();
  });

  describe('onModuleInit', () => {
    it('throws when PAYLOAD_ENCRYPTION_KEY is not set', async () => {
      const mod = await Test.createTestingModule({
        providers: [
          PayloadCryptoService,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        ],
      }).compile();
      const s = mod.get(PayloadCryptoService);
      expect(() => s.onModuleInit()).toThrow('PAYLOAD_ENCRYPTION_KEY is not set');
    });

    it('throws when key is not 32 bytes', async () => {
      const shortKey = Buffer.alloc(16).toString('base64');
      const mod = await Test.createTestingModule({
        providers: [
          PayloadCryptoService,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(shortKey) } },
        ],
      }).compile();
      const s = mod.get(PayloadCryptoService);
      expect(() => s.onModuleInit()).toThrow('must be 32 bytes');
    });
  });

  describe('encrypt / decrypt', () => {
    it('recovers original data after round-trip', () => {
      const data = { name: 'Alice', email: 'alice@example.com', age: 30 };
      const envelope = service.encrypt(data);
      expect(service.decrypt(envelope)).toEqual(data);
    });

    it('produces different ciphertext on each call (random IV)', () => {
      const data = { name: 'Alice' };
      const a = service.encrypt(data);
      const b = service.encrypt(data);
      expect(a['_enc']).not.toBe(b['_enc']);
      expect(a['_iv']).not.toBe(b['_iv']);
    });

    it('envelope contains exactly _enc, _iv, _tag keys', () => {
      const envelope = service.encrypt({ x: 1 });
      expect(Object.keys(envelope).sort()).toEqual(['_enc', '_iv', '_tag']);
    });

    it('throws when envelope is missing required keys', () => {
      expect(() => service.decrypt({})).toThrow('Invalid encryption envelope');
      expect(() => service.decrypt({ _enc: 'x' })).toThrow('Invalid encryption envelope');
    });

    it('throws when auth tag is tampered (GCM integrity)', () => {
      const envelope = service.encrypt({ secret: 'data' });
      envelope['_tag'] = Buffer.alloc(16, 0).toString('base64');
      expect(() => service.decrypt(envelope)).toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('returns true when _enc key is present', () => {
      expect(service.isEncrypted({ _enc: 'x', _iv: 'y', _tag: 'z' })).toBe(true);
    });

    it('returns false when _enc key is absent', () => {
      expect(service.isEncrypted({ name: 'Alice' })).toBe(false);
    });
  });

  describe('mask', () => {
    it('masks email field: keeps first 2 chars and domain', () => {
      const result = service.mask({ email: 'user@example.com' });
      expect(result['email']).toBe('us***@example.com');
    });

    it('masks name field: keeps first 2 chars', () => {
      const result = service.mask({ name: 'Alice' });
      expect(result['name']).toBe('Al***');
    });

    it('masks phoneNumber field: middle digits become *', () => {
      const result = service.mask({ phoneNumber: '010-1234-5678' });
      expect(result['phoneNumber']).not.toBe('010-1234-5678');
      expect(String(result['phoneNumber'])).toContain('****');
    });

    it('preserves numbers and booleans unchanged', () => {
      const result = service.mask({ count: 42, active: true });
      expect(result['count']).toBe(42);
      expect(result['active']).toBe(true);
    });

    it('recursively masks nested objects', () => {
      const result = service.mask({ user: { name: 'Bob', email: 'b@x.com' } });
      const user = result['user'] as Record<string, unknown>;
      expect(user['name']).toBe('Bo***');
      expect(user['email']).toBe('b***@x.com');
    });
  });
});
