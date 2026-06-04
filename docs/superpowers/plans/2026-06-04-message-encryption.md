# Message Payload Encryption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AES-256-GCM으로 메시지 payload를 암호화하여 DB와 Kafka 양쪽을 보호하고, 감사용 마스킹 뷰를 `maskedPayloadJson`에 저장한다.

**Architecture:** JSON 엔벨로프 패턴 — `payloadJson` 컬럼 타입 변경 없이 `{ _enc, _iv, _tag }` 구조로 저장. `encryptionStatus = ENCRYPTED`. 워커는 `_enc` 키 존재 여부로 복호화 여부를 판단.

**Tech Stack:** Node.js built-in `node:crypto` (AES-256-GCM), NestJS DI, ConfigService

---

## File Map

| Action | Path | 역할 |
|--------|------|------|
| Create | `libs/common/src/crypto/payload-crypto.service.ts` | 암호화·복호화·마스킹 핵심 로직 |
| Create | `libs/common/src/crypto/payload-crypto.module.ts` | NestJS 모듈 래퍼 |
| Create | `libs/common/test/crypto/payload-crypto.service.spec.ts` | 단위 테스트 |
| Modify | `libs/common/src/index.ts` | crypto export 추가 |
| Modify | `apps/api-gateway/src/modules/message-request/message-request.service.ts` | 암호화 + 마스킹 적용 |
| Modify | `apps/api-gateway/src/modules/message-request/message-request.module.ts` | PayloadCryptoModule import |
| Modify | `apps/api-gateway/test/modules/message-request/message-request.service.spec.ts` | 테스트 업데이트 |
| Modify | `apps/main/src/modules/retry-scheduler/retry-scheduler.service.ts` | 복호화 후 재발행 |
| Modify | `apps/main/src/main.module.ts` | PayloadCryptoModule import |
| Modify | `apps/main/test/modules/retry-scheduler/retry-scheduler.service.spec.ts` | 테스트 업데이트 |
| Modify | `libs/kafka/src/worker/base-worker.service.ts` | 수신 시 복호화 |
| Modify | `apps/worker-email/src/worker-email.module.ts` | PayloadCryptoModule import |
| Modify | `apps/worker-sms/src/worker-sms.module.ts` | PayloadCryptoModule import |
| Modify | `apps/worker-kakao/src/worker-kakao.module.ts` | PayloadCryptoModule import |

---

## Task 1: PayloadCryptoService 핵심 로직 (TDD)

**Files:**
- Create: `libs/common/test/crypto/payload-crypto.service.spec.ts`
- Create: `libs/common/src/crypto/payload-crypto.service.ts`

### 환경변수 키 생성 (먼저 실행)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

나온 값을 `.env`와 `.env.test`에 추가:
```
PAYLOAD_ENCRYPTION_KEY=<위에서 나온 base64 값>
```

- [ ] **Step 1: 테스트 파일 작성**

`libs/common/test/crypto/payload-crypto.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PayloadCryptoService } from '../../src/crypto/payload-crypto.service';

const VALID_KEY = Buffer.alloc(32, 'k').toString('base64');

async function buildService(key?: string): Promise<PayloadCryptoService> {
  const module = await Test.createTestingModule({
    providers: [
      PayloadCryptoService,
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockReturnValue(key ?? VALID_KEY) },
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
      const svc = await buildService(undefined);
      // Override to return undefined
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
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
yarn test libs/common/test/crypto/payload-crypto.service.spec.ts --no-coverage
```

예상: `Cannot find module '../../src/crypto/payload-crypto.service'`

- [ ] **Step 3: PayloadCryptoService 구현**

`libs/common/src/crypto/payload-crypto.service.ts`:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

@Injectable()
export class PayloadCryptoService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const raw = this.configService.get<string>('PAYLOAD_ENCRYPTION_KEY');
    if (!raw) throw new Error('PAYLOAD_ENCRYPTION_KEY is not set');
    this.key = Buffer.from(raw, 'base64');
    if (this.key.length !== 32) {
      throw new Error('PAYLOAD_ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
    }
  }

  encrypt(data: Record<string, unknown>): Record<string, unknown> {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final(),
    ]);
    return {
      _enc: encrypted.toString('base64'),
      _iv: iv.toString('base64'),
      _tag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(envelope: Record<string, unknown>): Record<string, unknown> {
    const enc = envelope['_enc'];
    const iv = envelope['_iv'];
    const tag = envelope['_tag'];
    if (typeof enc !== 'string' || typeof iv !== 'string' || typeof tag !== 'string') {
      throw new Error('Invalid encryption envelope');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(enc, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8')) as Record<string, unknown>;
  }

  isEncrypted(data: Record<string, unknown>): boolean {
    return '_enc' in data;
  }

  mask(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = this.maskValue(key.toLowerCase(), value);
    }
    return result;
  }

  private maskValue(key: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return this.mask(value as Record<string, unknown>);
    }
    if (typeof value !== 'string') return value;
    if (key.includes('email')) return this.maskEmail(value);
    if (key.includes('phone')) return this.maskPhone(value);
    return this.maskGeneric(value);
  }

  private maskEmail(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex < 0) return this.maskGeneric(email);
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex);
    const keep = Math.min(2, local.length - 1);
    return `${local.slice(0, keep)}***${domain}`;
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return phone.replace(/\d/g, '*');
    // Keep first 3 and last 4 digits; mask the rest
    const prefix = digits.slice(0, 3);
    const suffix = digits.slice(-4);
    const middleLen = digits.length - 7;
    const masked = '*'.repeat(Math.max(middleLen, 4));
    // Rebuild with original separators replaced
    return phone
      .replace(/\d+/, prefix)
      .replace(/\d{4}$/, suffix)
      .replace(/\d+/, masked);
  }

  private maskGeneric(value: string): string {
    const keep = Math.max(1, Math.ceil(value.length / 3));
    return `${value.slice(0, keep)}***`;
  }
}
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
yarn test libs/common/test/crypto/payload-crypto.service.spec.ts --no-coverage
```

예상: 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add libs/common/src/crypto/payload-crypto.service.ts libs/common/test/crypto/payload-crypto.service.spec.ts
git commit -m "feat: PayloadCryptoService — AES-256-GCM encrypt/decrypt/mask"
```

---

## Task 2: PayloadCryptoModule 생성 및 export 등록

**Files:**
- Create: `libs/common/src/crypto/payload-crypto.module.ts`
- Modify: `libs/common/src/index.ts`

- [ ] **Step 1: PayloadCryptoModule 작성**

`libs/common/src/crypto/payload-crypto.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PayloadCryptoService } from './payload-crypto.service';

@Module({
  imports: [ConfigModule],
  providers: [PayloadCryptoService],
  exports: [PayloadCryptoService],
})
export class PayloadCryptoModule {}
```

- [ ] **Step 2: libs/common/src/index.ts에 export 추가**

현재 파일 마지막에 추가:

```typescript
export * from './crypto/payload-crypto.module';
export * from './crypto/payload-crypto.service';
```

- [ ] **Step 3: TypeScript 빌드 확인**

```bash
yarn tsc --noEmit -p tsconfig.json
```

예상: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add libs/common/src/crypto/payload-crypto.module.ts libs/common/src/index.ts
git commit -m "feat: PayloadCryptoModule — NestJS module + export registration"
```

---

## Task 3: MessageRequestService 암호화 통합 (TDD)

**Files:**
- Modify: `apps/api-gateway/test/modules/message-request/message-request.service.spec.ts`
- Modify: `apps/api-gateway/src/modules/message-request/message-request.service.ts`
- Modify: `apps/api-gateway/src/modules/message-request/message-request.module.ts`

### 변경 내용 요약

`send()` 메서드에서:
- `dto.variables` → `mask()` → `maskedPayloadJson`
- `dto.variables` → `encrypt()` → `payloadJson` (엔벨로프), `encryptionStatus = ENCRYPTED`
- Kafka event `variables` = 암호화된 엔벨로프

`handleExistingRequest()` 메서드에서:
- `payload.payloadJson` → `decrypt()` if ENCRYPTED → Kafka event `variables`

- [ ] **Step 1: 테스트에 PayloadCryptoService mock 추가**

`apps/api-gateway/test/modules/message-request/message-request.service.spec.ts` 의 `describe('MessageRequestService')` 블록 안 `beforeEach`를 수정:

```typescript
// 기존 변수 선언부에 추가
let cryptoService: { encrypt: jest.Mock; decrypt: jest.Mock; mask: jest.Mock; isEncrypted: jest.Mock };
```

`beforeEach` 내부에 추가:
```typescript
cryptoService = {
  encrypt: jest.fn().mockReturnValue({ _enc: 'enc', _iv: 'iv', _tag: 'tag' }),
  decrypt: jest.fn().mockImplementation((v: Record<string, unknown>) => v),
  mask: jest.fn().mockReturnValue({ name: 'Al***' }),
  isEncrypted: jest.fn().mockImplementation((v: Record<string, unknown>) => '_enc' in v),
};
```

`Test.createTestingModule providers`에 추가:
```typescript
{ provide: PayloadCryptoService, useValue: cryptoService },
```

import 추가:
```typescript
import { PayloadCryptoService } from '@app/common';
```

- [ ] **Step 2: 새 테스트 케이스 추가 — FAIL 확인 전 준비**

`describe('new request flow')` 의 `'saves payload with correct fields'` 테스트를 수정:

```typescript
it('saves payload with correct fields (encrypted)', async () => {
  await service.send(auth, dto);

  expect(cryptoService.encrypt).toHaveBeenCalledWith(dto.variables);
  expect(cryptoService.mask).toHaveBeenCalledWith(dto.variables);
  expect(payloadRepo.create).toHaveBeenCalledWith(
    expect.objectContaining({
      payloadJson: { _enc: 'enc', _iv: 'iv', _tag: 'tag' },
      maskedPayloadJson: { name: 'Al***' },
      encryptionStatus: PayloadEncryptionStatus.ENCRYPTED,
    }),
  );
});
```

`describe('idempotent retry — VALIDATED status')` 의 `savedPayload` 픽스처를 수정:
```typescript
const savedPayload: MessagePayloadEntity = {
  id: 'payload-uuid',
  messageRequestId: 'req-entity-uuid',
  payloadJson: { _enc: 'enc', _iv: 'iv', _tag: 'tag' },
  maskedPayloadJson: { name: 'Al***' },
  encryptionStatus: PayloadEncryptionStatus.ENCRYPTED,
  createdAt: new Date(),
};
```

그리고 `decrypt` mock이 원래 variables를 반환하도록:
```typescript
cryptoService.decrypt.mockReturnValue({ name: 'Alice' });
```

- [ ] **Step 3: 테스트 실행 — FAIL 확인**

```bash
yarn test apps/api-gateway/test/modules/message-request/message-request.service.spec.ts --no-coverage
```

예상: `PayloadCryptoService` 관련 오류 또는 `encryptionStatus: PLAIN` assertion failure

- [ ] **Step 4: MessageRequestService 수정**

`apps/api-gateway/src/modules/message-request/message-request.service.ts`:

constructor에 `PayloadCryptoService` 추가:
```typescript
import { PayloadCryptoService } from '@app/common';

// constructor 파라미터에 추가:
private readonly payloadCryptoService: PayloadCryptoService,
```

`send()` 내부 transaction 블록에서 payloadEntity 생성 부분 수정 (현재 86-92번 줄):
```typescript
const maskedPayload = this.payloadCryptoService.mask(dto.variables);
const encryptedPayload = this.payloadCryptoService.encrypt(dto.variables);

const payloadEntity = manager.create(MessagePayloadEntity, {
  messageRequestId: savedRequest.id,
  payloadJson: encryptedPayload,
  maskedPayloadJson: maskedPayload,
  encryptionStatus: PayloadEncryptionStatus.ENCRYPTED,
});
await manager.save(payloadEntity);
```

event 생성 부분에서 `variables` 수정 (현재 114번 줄):
```typescript
variables: encryptedPayload,
```

`handleExistingRequest()` 내부 event 생성 부분에서 `variables` 수정 (현재 203번 줄):
```typescript
variables: payload.encryptionStatus === PayloadEncryptionStatus.ENCRYPTED
  ? this.payloadCryptoService.decrypt(payload.payloadJson)
  : payload.payloadJson,
```

- [ ] **Step 5: 테스트 실행 — PASS 확인**

```bash
yarn test apps/api-gateway/test/modules/message-request/message-request.service.spec.ts --no-coverage
```

예상: 모든 테스트 통과

- [ ] **Step 6: MessageRequestModule에 PayloadCryptoModule import**

`apps/api-gateway/src/modules/message-request/message-request.module.ts`:

imports 배열에 추가:
```typescript
import { PayloadCryptoModule } from '@app/common';

// @Module imports에 추가:
PayloadCryptoModule,
```

- [ ] **Step 7: 전체 테스트 실행**

```bash
yarn test --no-coverage
```

예상: 기존 통과 테스트 모두 유지

- [ ] **Step 8: 커밋**

```bash
git add apps/api-gateway/src/modules/message-request/message-request.service.ts \
        apps/api-gateway/src/modules/message-request/message-request.module.ts \
        apps/api-gateway/test/modules/message-request/message-request.service.spec.ts
git commit -m "feat: MessageRequestService — payload 암호화 + maskedPayloadJson 저장"
```

---

## Task 4: RetrySchedulerService 복호화 통합 (TDD)

**Files:**
- Modify: `apps/main/test/modules/retry-scheduler/retry-scheduler.service.spec.ts`
- Modify: `apps/main/src/modules/retry-scheduler/retry-scheduler.service.ts`
- Modify: `apps/main/src/main.module.ts`

### 변경 내용 요약

`retryDispatch()` 내 Kafka 재발행 시 `payload.payloadJson`이 ENCRYPTED이면 복호화 후 발행.

- [ ] **Step 1: 테스트에 PayloadCryptoService mock 추가**

`apps/main/test/modules/retry-scheduler/retry-scheduler.service.spec.ts`:

`makePayload()` 함수 수정 — 암호화된 payload 반환:
```typescript
function makePayload(): MessagePayloadEntity {
  return {
    id: 'payload-uuid',
    messageRequestId: 'req-entity-uuid',
    payloadJson: { _enc: 'enc', _iv: 'iv', _tag: 'tag' },
    maskedPayloadJson: { name: 'Al***' },
    encryptionStatus: PayloadEncryptionStatus.ENCRYPTED,
    createdAt: new Date(),
  } satisfies MessagePayloadEntity;
}
```

변수 선언부에 추가:
```typescript
let cryptoService: { decrypt: jest.Mock; isEncrypted: jest.Mock };
```

`beforeEach` 내부에 추가:
```typescript
cryptoService = {
  decrypt: jest.fn().mockReturnValue({ name: 'Alice' }),
  isEncrypted: jest.fn().mockImplementation((v: Record<string, unknown>) => '_enc' in v),
};
```

`providers` 배열에 추가:
```typescript
{ provide: PayloadCryptoService, useValue: cryptoService },
```

import 추가:
```typescript
import { PayloadCryptoService } from '@app/common';
```

새 테스트 케이스 추가:
```typescript
it('decrypts encrypted payload before publishing to Kafka', async () => {
  dispatchRepo.find.mockResolvedValue([makeDispatch()]);
  requestRepo.findOne.mockResolvedValue(makeRequest());
  payloadRepo.findOne.mockResolvedValue(makePayload());
  recipientRepo.findOne.mockResolvedValue(makeRecipient());
  kafkaService.publishMessageSend.mockResolvedValue(undefined);
  dispatchRepo.save.mockResolvedValue({});

  await service.retryPendingDispatches();

  expect(cryptoService.decrypt).toHaveBeenCalledWith({ _enc: 'enc', _iv: 'iv', _tag: 'tag' });
  expect(kafkaService.publishMessageSend).toHaveBeenCalledWith(
    expect.objectContaining({ variables: { name: 'Alice' } }),
  );
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
yarn test apps/main/test/modules/retry-scheduler/retry-scheduler.service.spec.ts --no-coverage
```

예상: `PayloadCryptoService` 미주입 오류 또는 assertion failure

- [ ] **Step 3: RetrySchedulerService 수정**

`apps/main/src/modules/retry-scheduler/retry-scheduler.service.ts`:

import 추가:
```typescript
import { PayloadCryptoService } from '@app/common';
import { PayloadEncryptionStatus } from '@app/database';
```

constructor에 추가:
```typescript
private readonly payloadCryptoService: PayloadCryptoService,
```

`retryDispatch()` 내 event 생성 직전에 수정 (현재 84번 줄 `variables: payload.payloadJson` 부분):
```typescript
const variables =
  payload.encryptionStatus === PayloadEncryptionStatus.ENCRYPTED
    ? this.payloadCryptoService.decrypt(payload.payloadJson)
    : payload.payloadJson;

// 나머지 event 필드는 기존 코드 그대로 유지, variables만 교체
const event: MessageSendEvent = {
  messageRequestId: request.id,
  requestId: request.requestId,
  recipientId: recipient.id,
  clientAppId: request.clientAppId,
  templateCode: request.templateCode ?? '',
  channel,
  receiver: {
    userId: recipient.userId,
    receiverName: recipient.receiverName,
    email: recipient.email,
    phoneNumber: recipient.phoneNumber,
    kakaoPhoneNumber: recipient.kakaoPhoneNumber,
  },
  variables,
  priority: request.priority,
  callbackUrl: request.callbackUrl,
  requestedAt: request.requestedAt.toISOString(),
};
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
yarn test apps/main/test/modules/retry-scheduler/retry-scheduler.service.spec.ts --no-coverage
```

예상: 모든 테스트 통과

- [ ] **Step 5: MainModule에 PayloadCryptoModule import**

`apps/main/src/main.module.ts`:

```typescript
import { PayloadCryptoModule } from '@app/common';

// @Module imports에 추가:
PayloadCryptoModule,

// providers에 PayloadCryptoService 추가 (RetrySchedulerService가 사용):
// (PayloadCryptoModule이 export하므로 별도 추가 불필요 — NestJS가 자동 해결)
```

- [ ] **Step 6: 커밋**

```bash
git add apps/main/src/modules/retry-scheduler/retry-scheduler.service.ts \
        apps/main/src/main.module.ts \
        apps/main/test/modules/retry-scheduler/retry-scheduler.service.spec.ts
git commit -m "feat: RetrySchedulerService — 재시도 시 payload 복호화 후 Kafka 재발행"
```

---

## Task 5: BaseWorkerService 복호화 통합 + 워커 모듈 연동

**Files:**
- Modify: `libs/kafka/src/worker/base-worker.service.ts`
- Modify: `apps/worker-email/src/worker-email.module.ts`
- Modify: `apps/worker-sms/src/worker-sms.module.ts`
- Modify: `apps/worker-kakao/src/worker-kakao.module.ts`

### 변경 내용 요약

`BaseWorkerService`의 `eachMessage` 핸들러에서 Kafka 이벤트 파싱 후 `_enc` 키가 있으면 복호화.
`@Optional()` 데코레이터로 선택적 주입 — 모듈에 `PayloadCryptoModule`이 없어도 크래시 안 함.

- [ ] **Step 1: BaseWorkerService 수정**

`libs/kafka/src/worker/base-worker.service.ts` import 추가:
```typescript
import { Optional } from '@nestjs/common';
import { PayloadCryptoService } from '@app/common';
```

constructor에 추가 (기존 파라미터 뒤에):
```typescript
@Optional() private readonly payloadCryptoService?: PayloadCryptoService,
```

`eachMessage` 핸들러 내부 수정 (현재 70-72번 줄):
```typescript
const event = JSON.parse(message.value.toString()) as MessageSendEvent;
if (event.channel !== this.channelType) return;

if (this.payloadCryptoService && this.payloadCryptoService.isEncrypted(event.variables)) {
  event.variables = this.payloadCryptoService.decrypt(event.variables);
}

await this.process(event);
```

- [ ] **Step 2: 워커 모듈 3개에 PayloadCryptoModule import**

`apps/worker-email/src/worker-email.module.ts`:
```typescript
import { PayloadCryptoModule } from '@app/common';

// @Module imports에 추가:
PayloadCryptoModule,
```

`apps/worker-sms/src/worker-sms.module.ts`:
```typescript
import { PayloadCryptoModule } from '@app/common';

// @Module imports에 추가:
PayloadCryptoModule,
```

`apps/worker-kakao/src/worker-kakao.module.ts`:
```typescript
import { PayloadCryptoModule } from '@app/common';

// @Module imports에 추가:
PayloadCryptoModule,
```

- [ ] **Step 3: TypeScript 빌드 확인**

```bash
yarn tsc --noEmit -p tsconfig.json
```

예상: 오류 없음

- [ ] **Step 4: 전체 테스트 실행**

```bash
yarn test --no-coverage
```

예상: 기존 테스트 모두 통과 (워커 controller 테스트 포함)

- [ ] **Step 5: 커밋**

```bash
git add libs/kafka/src/worker/base-worker.service.ts \
        apps/worker-email/src/worker-email.module.ts \
        apps/worker-sms/src/worker-sms.module.ts \
        apps/worker-kakao/src/worker-kakao.module.ts
git commit -m "feat: BaseWorkerService — Kafka 수신 시 payload 자동 복호화"
```

---

## Task 6: 최종 검증

- [ ] **Step 1: 전체 테스트 스위트 실행**

```bash
yarn test --no-coverage
```

예상: 모든 테스트 통과. 신규 `payload-crypto.service.spec.ts` 포함.

- [ ] **Step 2: `.env.example` 업데이트**

`.env.example` 파일에 항목 추가:
```bash
# 메시지 payload 암호화 키 (32바이트 랜덤, base64 인코딩)
# 생성: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
PAYLOAD_ENCRYPTION_KEY=
```

- [ ] **Step 3: 최종 커밋**

```bash
git add .env.example
git commit -m "chore: .env.example에 PAYLOAD_ENCRYPTION_KEY 항목 추가"
```

---

## 구현 후 확인 체크리스트

- [ ] `PayloadCryptoService` 단위 테스트 모두 통과
- [ ] `MessageRequestService` 테스트: `encryptionStatus: ENCRYPTED`, `_enc` 키 확인
- [ ] `RetrySchedulerService` 테스트: `decrypt` 호출 확인
- [ ] 전체 테스트 스위트 통과 (기존 회귀 없음)
- [ ] `.env` 및 `.env.test`에 `PAYLOAD_ENCRYPTION_KEY` 설정됨
- [ ] TypeScript 빌드 오류 없음
