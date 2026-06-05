# Error Code Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ErrorCode enum + 한국어 메시지 맵 + AppException을 만들고, 코드베이스 전체 23개 throw 사이트를 교체해 에러 응답에 `errorCode` 필드를 포함시킨다.

**Architecture:** `libs/common/src/errors/`에 공유 에러 코드 체계(enum + 메시지 맵 + AppException 클래스)를 만들고 `HttpExceptionFilter`를 업데이트. 각 앱의 guard/service는 기존 NestJS 예외 대신 `AppException`을 throw.

**Tech Stack:** NestJS `HttpException` 상속, TypeScript enum, `@app/common` 공유 패키지

---

## File Map

| Action | Path |
|--------|------|
| Create | `libs/common/src/errors/error-code.enum.ts` |
| Create | `libs/common/src/errors/error-messages.ts` |
| Create | `libs/common/src/errors/app.exception.ts` |
| Create | `libs/common/src/errors/index.ts` |
| Create | `libs/common/test/errors/app.exception.spec.ts` |
| Modify | `libs/common/src/index.ts` |
| Modify | `libs/common/src/filters/http-exception.filter.ts` |
| Modify | `libs/common/test/filters/http-exception.filter.spec.ts` |
| Modify | `apps/admin-api/src/guards/admin-auth.guard.ts` |
| Modify | `apps/admin-api/test/guards/admin-auth.guard.spec.ts` |
| Modify | `apps/admin-api/src/modules/client-api-key/client-api-key.service.ts` |
| Modify | `apps/api-gateway/src/modules/auth/client-auth.service.ts` |
| Modify | `apps/api-gateway/test/modules/auth/client-auth.service.spec.ts` |
| Modify | `apps/api-gateway/src/guards/client-permission.guard.ts` |
| Modify | `apps/api-gateway/test/guards/client-permission.guard.spec.ts` |
| Modify | `apps/api-gateway/src/guards/rate-limit.guard.ts` |
| Modify | `apps/api-gateway/test/guards/rate-limit.guard.spec.ts` |
| Modify | `apps/api-gateway/src/modules/template/template.service.ts` |
| Modify | `apps/api-gateway/test/modules/template/template.service.spec.ts` |
| Modify | `apps/api-gateway/src/modules/message-request/message-request.service.ts` |
| Modify | `apps/api-gateway/test/modules/message-request/message-request.service.spec.ts` |
| Modify | `README.md` |

---

## Task 1: ErrorCode + 메시지 맵 + AppException (TDD)

**Files:**
- Create: `libs/common/test/errors/app.exception.spec.ts`
- Create: `libs/common/src/errors/error-code.enum.ts`
- Create: `libs/common/src/errors/error-messages.ts`
- Create: `libs/common/src/errors/app.exception.ts`
- Create: `libs/common/src/errors/index.ts`
- Modify: `libs/common/src/index.ts`

- [ ] **Step 1: AppException 테스트 작성**

`libs/common/test/errors/app.exception.spec.ts`:

```typescript
import { HttpException } from '@nestjs/common';
import { AppException } from '../../src/errors/app.exception';
import { ErrorCode } from '../../src/errors/error-code.enum';
import { ERROR_MESSAGES } from '../../src/errors/error-messages';

describe('AppException', () => {
  it('stores the errorCode', () => {
    const ex = new AppException(ErrorCode.AUTH_INVALID_API_KEY, 401);
    expect(ex.errorCode).toBe(ErrorCode.AUTH_INVALID_API_KEY);
  });

  it('sets HTTP status from constructor', () => {
    const ex = new AppException(ErrorCode.RATE_LIMIT_EXCEEDED, 429);
    expect(ex.getStatus()).toBe(429);
  });

  it('includes Korean message from ERROR_MESSAGES in response', () => {
    const ex = new AppException(ErrorCode.AUTH_INVALID_API_KEY, 401);
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body['message']).toBe(ERROR_MESSAGES[ErrorCode.AUTH_INVALID_API_KEY]);
  });

  it('includes errorCode in response body', () => {
    const ex = new AppException(ErrorCode.PERM_INSUFFICIENT, 403);
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body['errorCode']).toBe(ErrorCode.PERM_INSUFFICIENT);
  });

  it('is instanceof HttpException', () => {
    const ex = new AppException(ErrorCode.SYS_INTERNAL_ERROR, 500);
    expect(ex).toBeInstanceOf(HttpException);
    expect(ex).toBeInstanceOf(AppException);
  });
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
yarn test libs/common/test/errors/app.exception.spec.ts --no-coverage
```

예상: `Cannot find module '../../src/errors/app.exception'`

- [ ] **Step 3: ErrorCode enum 생성**

`libs/common/src/errors/error-code.enum.ts`:

```typescript
export enum ErrorCode {
  AUTH_MISSING_HEADERS = 'AUTH_001',
  AUTH_INVALID_API_KEY = 'AUTH_002',
  AUTH_API_KEY_INACTIVE = 'AUTH_003',
  AUTH_API_KEY_EXPIRED = 'AUTH_004',
  AUTH_INVALID_SECRET = 'AUTH_005',
  AUTH_CLIENT_APP_INACTIVE = 'AUTH_006',
  AUTH_ADMIN_REQUIRED = 'AUTH_007',
  AUTH_IP_NOT_ALLOWED = 'AUTH_008',
  PERM_INSUFFICIENT = 'PERM_001',
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  MSG_TEMPLATE_NOT_FOUND = 'MSG_001',
  MSG_TEMPLATE_ACCESS_DENIED = 'MSG_002',
  MSG_INVALID_VARIABLES = 'MSG_003',
  MSG_PAYLOAD_NOT_FOUND = 'MSG_004',
  MSG_REQUEST_DATA_MISSING = 'MSG_005',
  MSG_KAFKA_PUBLISH_FAILED = 'MSG_006',
  CLIENT_APP_NOT_FOUND = 'CLIENT_001',
  SYS_INTERNAL_ERROR = 'SYS_001',
}
```

- [ ] **Step 4: 한국어 메시지 맵 생성**

`libs/common/src/errors/error-messages.ts`:

```typescript
import { ErrorCode } from './error-code.enum';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_MISSING_HEADERS]: 'API 키 헤더(x-api-key, x-api-secret)가 누락되었습니다.',
  [ErrorCode.AUTH_INVALID_API_KEY]: '유효하지 않은 API 키입니다.',
  [ErrorCode.AUTH_API_KEY_INACTIVE]: 'API 키가 비활성화 상태입니다.',
  [ErrorCode.AUTH_API_KEY_EXPIRED]: 'API 키가 만료되었습니다.',
  [ErrorCode.AUTH_INVALID_SECRET]: 'API 시크릿이 올바르지 않습니다.',
  [ErrorCode.AUTH_CLIENT_APP_INACTIVE]: '클라이언트 앱이 비활성화 상태입니다.',
  [ErrorCode.AUTH_ADMIN_REQUIRED]: '관리자 권한이 필요합니다.',
  [ErrorCode.AUTH_IP_NOT_ALLOWED]: '허용되지 않은 IP 주소입니다.',
  [ErrorCode.PERM_INSUFFICIENT]: '해당 작업에 대한 권한이 없습니다.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
  [ErrorCode.MSG_TEMPLATE_NOT_FOUND]: '요청한 템플릿을 찾을 수 없습니다.',
  [ErrorCode.MSG_TEMPLATE_ACCESS_DENIED]: '해당 템플릿에 대한 접근 권한이 없습니다.',
  [ErrorCode.MSG_INVALID_VARIABLES]: '템플릿 변수가 올바르지 않습니다.',
  [ErrorCode.MSG_PAYLOAD_NOT_FOUND]: '메시지 payload를 찾을 수 없습니다.',
  [ErrorCode.MSG_REQUEST_DATA_MISSING]: '기존 요청의 데이터가 올바르지 않습니다.',
  [ErrorCode.MSG_KAFKA_PUBLISH_FAILED]: '메시지 요청은 저장되었지만 발행에 실패했습니다. 동일한 requestId로 재시도하세요.',
  [ErrorCode.CLIENT_APP_NOT_FOUND]: '클라이언트 앱을 찾을 수 없습니다.',
  [ErrorCode.SYS_INTERNAL_ERROR]: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
};
```

- [ ] **Step 5: AppException 클래스 생성**

`libs/common/src/errors/app.exception.ts`:

```typescript
import { HttpException } from '@nestjs/common';
import { ErrorCode } from './error-code.enum';
import { ERROR_MESSAGES } from './error-messages';

export class AppException extends HttpException {
  readonly errorCode: ErrorCode;

  constructor(errorCode: ErrorCode, statusCode: number) {
    super({ errorCode, message: ERROR_MESSAGES[errorCode] }, statusCode);
    this.errorCode = errorCode;
  }
}
```

- [ ] **Step 6: index 파일 생성**

`libs/common/src/errors/index.ts`:

```typescript
export * from './error-code.enum';
export * from './error-messages';
export * from './app.exception';
```

- [ ] **Step 7: libs/common/src/index.ts 업데이트**

`libs/common/src/index.ts`의 `export * from './filters';` 앞에 추가:

```typescript
export * from './errors';
```

최종 파일:

```typescript
export * from './common.module';
export * from './common.service';
export * from './middleware/request-id.middleware';
export * from './logger';
export * from './redis';
export * from './metrics';
export * from './tracing';
export * from './crypto/payload-crypto.module';
export * from './crypto/payload-crypto.service';
export * from './errors';
export * from './filters';
```

- [ ] **Step 8: 테스트 실행 — PASS 확인**

```bash
yarn test libs/common/test/errors/app.exception.spec.ts --no-coverage
```

예상: 5개 테스트 통과

- [ ] **Step 9: 커밋**

```bash
git add libs/common/src/errors/ libs/common/test/errors/ libs/common/src/index.ts
git commit -m "feat: ErrorCode enum + 한국어 메시지 맵 + AppException 클래스"
```

---

## Task 2: HttpExceptionFilter — AppException 처리 추가

**Files:**
- Modify: `libs/common/src/filters/http-exception.filter.ts`
- Modify: `libs/common/test/filters/http-exception.filter.spec.ts`

### 변경 요약

- `AppException` → `errorCode` 포함, `ERROR_MESSAGES`의 한국어 메시지 사용 (5xx도 노출)
- 일반 `HttpException` → `errorCode: null`
- 일반 `Error` → `errorCode: SYS_001`, 한국어 시스템 오류 메시지

- [ ] **Step 1: 기존 테스트에 AppException 케이스 추가**

`libs/common/test/filters/http-exception.filter.spec.ts` 파일에 `describe('AppException')` 블록 추가:

```typescript
// 파일 상단 import에 추가:
import { AppException } from '../../src/errors/app.exception';
import { ErrorCode } from '../../src/errors/error-code.enum';
import { ERROR_MESSAGES } from '../../src/errors/error-messages';

// describe('HttpExceptionFilter') 안에 새 describe 블록 추가:
describe('AppException', () => {
  it('includes errorCode in response', () => {
    const { host, json } = makeHost();
    filter.catch(new AppException(ErrorCode.AUTH_INVALID_API_KEY, 401), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorCode: ErrorCode.AUTH_INVALID_API_KEY,
        message: ERROR_MESSAGES[ErrorCode.AUTH_INVALID_API_KEY],
      }),
    );
  });

  it('shows Korean message even for 5xx AppException', () => {
    const { host, status, json } = makeHost();
    filter.catch(new AppException(ErrorCode.MSG_KAFKA_PUBLISH_FAILED, 503), host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ErrorCode.MSG_KAFKA_PUBLISH_FAILED,
        message: ERROR_MESSAGES[ErrorCode.MSG_KAFKA_PUBLISH_FAILED],
      }),
    );
  });

  it('logs at error level for 5xx AppException', () => {
    const { host } = makeHost();
    filter.catch(new AppException(ErrorCode.MSG_KAFKA_PUBLISH_FAILED, 503), host);

    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('Generic Error — SYS_001', () => {
  it('uses SYS_001 errorCode for unknown errors', () => {
    const { host, json } = makeHost();
    filter.catch(new Error('DB connection failed'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ErrorCode.SYS_INTERNAL_ERROR,
        message: ERROR_MESSAGES[ErrorCode.SYS_INTERNAL_ERROR],
      }),
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인 (AppException 케이스들)**

```bash
yarn test libs/common/test/filters/http-exception.filter.spec.ts --no-coverage
```

예상: AppException / SYS_001 관련 테스트 실패 (filter가 아직 AppException 처리 안 함)

- [ ] **Step 3: HttpExceptionFilter 업데이트**

`libs/common/src/filters/http-exception.filter.ts` 전체:

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code.enum';
import { ERROR_MESSAGES } from '../errors/error-messages';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, errorCode } = this.resolveException(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(`${request.method} ${request.url} → ${statusCode}: ${message}`);
    }

    response.status(statusCode).json({
      success: false,
      errorCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    message: string;
    errorCode: string | null;
  } {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        errorCode: exception.errorCode,
        message: ERROR_MESSAGES[exception.errorCode as ErrorCode],
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();
      let message: string;
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const raw = (res as Record<string, unknown>)['message'];
        message = Array.isArray(raw) ? raw.join(', ') : String(raw);
      } else {
        message = exception.message;
      }
      return { statusCode, message, errorCode: null };
    }

    return {
      statusCode: 500,
      errorCode: ErrorCode.SYS_INTERNAL_ERROR,
      message: ERROR_MESSAGES[ErrorCode.SYS_INTERNAL_ERROR],
    };
  }
}
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
yarn test libs/common/test/filters/http-exception.filter.spec.ts --no-coverage
```

예상: 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add libs/common/src/filters/http-exception.filter.ts \
        libs/common/test/filters/http-exception.filter.spec.ts
git commit -m "feat: HttpExceptionFilter — AppException errorCode 포함, 5xx SYS_001 코드"
```

---

## Task 3: AdminAuthGuard — AppException 교체

**Files:**
- Modify: `apps/admin-api/src/guards/admin-auth.guard.ts`
- Modify: `apps/admin-api/test/guards/admin-auth.guard.spec.ts`

- [ ] **Step 1: admin-auth.guard.ts 수정**

`apps/admin-api/src/guards/admin-auth.guard.ts` 전체:

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyStatus, ApiKeyType, ClientApiKeyEntity, ClientAppEntity, ClientAppStatus } from '@app/database';
import { AppException, ErrorCode } from '@app/common';
import { Request } from 'express';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(ClientApiKeyEntity)
    private readonly clientApiKeyRepository: Repository<ClientApiKeyEntity>,
    @InjectRepository(ClientAppEntity)
    private readonly clientAppRepository: Repository<ClientAppEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const keyId = request.header('x-api-key');
    const plainSecret = request.header('x-api-secret');

    if (!keyId || !plainSecret) {
      throw new AppException(ErrorCode.AUTH_MISSING_HEADERS, 401);
    }

    const apiKey = await this.clientApiKeyRepository.findOne({ where: { keyId } });
    if (!apiKey) {
      throw new AppException(ErrorCode.AUTH_INVALID_API_KEY, 401);
    }

    if (apiKey.keyType !== ApiKeyType.ADMIN) {
      throw new AppException(ErrorCode.AUTH_ADMIN_REQUIRED, 401);
    }

    if (apiKey.status !== ApiKeyStatus.ACTIVE) {
      throw new AppException(ErrorCode.AUTH_API_KEY_INACTIVE, 401);
    }

    if (apiKey.expiredAt && apiKey.expiredAt.getTime() <= Date.now()) {
      throw new AppException(ErrorCode.AUTH_API_KEY_EXPIRED, 401);
    }

    const secretHash = createHash('sha256').update(plainSecret).digest('hex');
    const left = Buffer.from(secretHash, 'utf8');
    const right = Buffer.from(apiKey.secretHash, 'utf8');

    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new AppException(ErrorCode.AUTH_INVALID_SECRET, 401);
    }

    const clientApp = await this.clientAppRepository.findOne({ where: { id: apiKey.clientAppId } });
    if (!clientApp || clientApp.status !== ClientAppStatus.ACTIVE) {
      throw new AppException(ErrorCode.AUTH_CLIENT_APP_INACTIVE, 401);
    }

    apiKey.lastUsedAt = new Date();
    await this.clientApiKeyRepository.save(apiKey);

    (request as unknown as Record<string, unknown>)['adminKeyId'] = apiKey.id;

    return true;
  }
}
```

- [ ] **Step 2: admin-auth.guard.spec.ts 업데이트 — 에러 코드 기반 검증으로 변경**

`apps/admin-api/test/guards/admin-auth.guard.spec.ts`에서:
- `import { UnauthorizedException }` → `import { AppException, ErrorCode } from '@app/common'`
- 모든 `rejects.toThrow(new UnauthorizedException('...'))` → `rejects.toMatchObject({ errorCode: ErrorCode.XXX })`

전체 파일:

```typescript
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

  it('allows when key has future expiry', async () => {
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
});
```

- [ ] **Step 3: 테스트 실행 — PASS 확인**

```bash
yarn test apps/admin-api/test/guards/admin-auth.guard.spec.ts --no-coverage
```

예상: 모든 테스트 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/admin-api/src/guards/admin-auth.guard.ts \
        apps/admin-api/test/guards/admin-auth.guard.spec.ts
git commit -m "feat: AdminAuthGuard — AppException + ErrorCode 교체"
```

---

## Task 4: ClientAuthService — AppException 교체

**Files:**
- Modify: `apps/api-gateway/src/modules/auth/client-auth.service.ts`
- Modify: `apps/api-gateway/test/modules/auth/client-auth.service.spec.ts`

- [ ] **Step 1: client-auth.service.ts 수정**

`apps/api-gateway/src/modules/auth/client-auth.service.ts`:

import 변경:
```typescript
// 삭제:
import { Injectable, UnauthorizedException } from '@nestjs/common';
// 추가:
import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '@app/common';
```

throw 교체 (7개):
```typescript
// 기존 → 교체
throw new UnauthorizedException('Missing API key headers');
→ throw new AppException(ErrorCode.AUTH_MISSING_HEADERS, 401);

throw new UnauthorizedException('Invalid API key');
→ throw new AppException(ErrorCode.AUTH_INVALID_API_KEY, 401);

throw new UnauthorizedException('API key is not active');
→ throw new AppException(ErrorCode.AUTH_API_KEY_INACTIVE, 401);

throw new UnauthorizedException('API key expired');
→ throw new AppException(ErrorCode.AUTH_API_KEY_EXPIRED, 401);

throw new UnauthorizedException('Invalid API secret');
→ throw new AppException(ErrorCode.AUTH_INVALID_SECRET, 401);

throw new UnauthorizedException('Client app is not active');
→ throw new AppException(ErrorCode.AUTH_CLIENT_APP_INACTIVE, 401);

throw new UnauthorizedException('IP address not allowed');  // assertIpAllowed 메서드
→ throw new AppException(ErrorCode.AUTH_IP_NOT_ALLOWED, 401);
```

- [ ] **Step 2: client-auth.service.spec.ts 업데이트**

import 변경:
```typescript
// 삭제:
import { UnauthorizedException } from '@nestjs/common';
// 추가:
import { AppException, ErrorCode } from '@app/common';
```

모든 `rejects.toThrow(new UnauthorizedException('...'))` → `rejects.toMatchObject({ errorCode: ErrorCode.XXX })`:

```typescript
// 기존 → 교체 (12개 throw 검증)
it('throws when x-api-key header is missing', async () => {
  await expect(service.authenticate(makeRequest(undefined, PLAIN_SECRET))).rejects.toMatchObject({
    errorCode: ErrorCode.AUTH_MISSING_HEADERS,
  });
});

it('throws when x-api-secret header is missing', async () => {
  await expect(service.authenticate(makeRequest('mst_test_abc123', undefined))).rejects.toMatchObject({
    errorCode: ErrorCode.AUTH_MISSING_HEADERS,
  });
});

it('throws when API key not found', async () => {
  apiKeyRepo.findOne.mockResolvedValue(null);
  await expect(service.authenticate(makeRequest('unknown', PLAIN_SECRET))).rejects.toMatchObject({
    errorCode: ErrorCode.AUTH_INVALID_API_KEY,
  });
});

it('throws when API key is revoked', async () => {
  apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ status: ApiKeyStatus.REVOKED }));
  await expect(service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET))).rejects.toMatchObject({
    errorCode: ErrorCode.AUTH_API_KEY_INACTIVE,
  });
});

it('throws when API key is expired', async () => {
  const expiredAt = new Date(Date.now() - 1000);
  apiKeyRepo.findOne.mockResolvedValue(makeApiKey({ expiredAt }));
  await expect(service.authenticate(makeRequest('mst_test_abc123', PLAIN_SECRET))).rejects.toMatchObject({
    errorCode: ErrorCode.AUTH_API_KEY_EXPIRED,
  });
});

// 나머지 throw 검증 케이스들도 동일 패턴으로 업데이트
// (아래 테스트는 기존 파일에서 찾아 동일하게 교체)
```

- [ ] **Step 3: 테스트 실행 — PASS 확인**

```bash
yarn test apps/api-gateway/test/modules/auth/client-auth.service.spec.ts --no-coverage
```

예상: 모든 테스트 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/api-gateway/src/modules/auth/client-auth.service.ts \
        apps/api-gateway/test/modules/auth/client-auth.service.spec.ts
git commit -m "feat: ClientAuthService — AppException + ErrorCode 교체"
```

---

## Task 5: Guards — ClientPermission + RateLimit 교체

**Files:**
- Modify: `apps/api-gateway/src/guards/client-permission.guard.ts`
- Modify: `apps/api-gateway/test/guards/client-permission.guard.spec.ts`
- Modify: `apps/api-gateway/src/guards/rate-limit.guard.ts`
- Modify: `apps/api-gateway/test/guards/rate-limit.guard.spec.ts`

- [ ] **Step 1: client-permission.guard.ts 수정**

```typescript
// import 변경:
// 삭제: import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
// 추가:
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '@app/common';

// throw 교체:
// 기존:
throw new ForbiddenException(`Permission denied: ${required}`);
// 교체:
throw new AppException(ErrorCode.PERM_INSUFFICIENT, 403);
```

- [ ] **Step 2: client-permission.guard.spec.ts 업데이트**

```typescript
// import 변경:
// 삭제: import { ExecutionContext, ForbiddenException } from '@nestjs/common';
// 추가:
import { ExecutionContext } from '@nestjs/common';
import { AppException, ErrorCode } from '@app/common';

// throw 검증 교체:
it('throws PERM_INSUFFICIENT when permission not found', async () => {
  permRepo.findOne.mockResolvedValue(null);
  const ctx = makeContext('app-1', ClientPermissionType.SEND_MESSAGE);
  await expect(guard.canActivate(ctx)).rejects.toMatchObject({
    errorCode: ErrorCode.PERM_INSUFFICIENT,
  });
});
```

- [ ] **Step 3: rate-limit.guard.ts 수정**

```typescript
// import 변경:
// 삭제: import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
// 추가:
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '@app/common';

// throw 교체:
// 기존:
throw new HttpException(
  `Rate limit exceeded: max ${rateLimitPerMinute} requests per minute`,
  HttpStatus.TOO_MANY_REQUESTS,
);
// 교체:
throw new AppException(ErrorCode.RATE_LIMIT_EXCEEDED, 429);
```

- [ ] **Step 4: rate-limit.guard.spec.ts 업데이트**

```typescript
// import 변경:
// 삭제: import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
// 추가:
import { ExecutionContext } from '@nestjs/common';
import { AppException, ErrorCode } from '@app/common';

// throw 검증 교체:
it('throws RATE_LIMIT_EXCEEDED when count exceeds limit', async () => {
  const guard = await buildGuard(4);
  const ctx = makeContext('app-2', 3);
  await expect(guard.canActivate(ctx)).rejects.toMatchObject({
    errorCode: ErrorCode.RATE_LIMIT_EXCEEDED,
  });
});

it('throws when count is one over the limit', async () => {
  const guard = await buildGuard(4);
  const ctx = makeContext('app-4', 3);
  await expect(guard.canActivate(ctx)).rejects.toMatchObject({
    errorCode: ErrorCode.RATE_LIMIT_EXCEEDED,
  });
});
```

- [ ] **Step 5: 테스트 실행 — PASS 확인**

```bash
yarn test apps/api-gateway/test/guards/ --no-coverage
```

예상: 모든 guard 테스트 통과

- [ ] **Step 6: 커밋**

```bash
git add apps/api-gateway/src/guards/ apps/api-gateway/test/guards/
git commit -m "feat: ClientPermissionGuard + RateLimitGuard — AppException + ErrorCode 교체"
```

---

## Task 6: Services — ClientApiKey + Template + MessageRequest 교체

**Files:**
- Modify: `apps/admin-api/src/modules/client-api-key/client-api-key.service.ts`
- Modify: `apps/api-gateway/src/modules/template/template.service.ts`
- Modify: `apps/api-gateway/test/modules/template/template.service.spec.ts`
- Modify: `apps/api-gateway/src/modules/message-request/message-request.service.ts`
- Modify: `apps/api-gateway/test/modules/message-request/message-request.service.spec.ts`

- [ ] **Step 1: client-api-key.service.ts 수정**

```typescript
// import 변경:
// 삭제: import { Injectable, NotFoundException } from '@nestjs/common';
// 추가:
import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '@app/common';

// throw 교체:
// 기존:
throw new NotFoundException('Client app not found');
// 교체:
throw new AppException(ErrorCode.CLIENT_APP_NOT_FOUND, 404);
```

- [ ] **Step 2: template.service.ts 수정**

```typescript
// import 변경:
// 삭제: import { Injectable, NotFoundException } from '@nestjs/common';
// 추가:
import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '@app/common';

// throw 교체 (2개):
// getTemplateByCode line 28:
throw new NotFoundException('Template not found');
→ throw new AppException(ErrorCode.MSG_TEMPLATE_NOT_FOUND, 404);

// assertTemplateAccessible line 90:
throw new NotFoundException('Template not found');
→ throw new AppException(ErrorCode.MSG_TEMPLATE_NOT_FOUND, 404);
```

- [ ] **Step 3: template.service.spec.ts 업데이트**

```typescript
// import 변경:
// 삭제: import { NotFoundException } from '@nestjs/common';
// 추가:
import { AppException, ErrorCode } from '@app/common';

// throw 검증 교체 (NotFoundException 관련 모든 케이스):
// 예시:
it('throws MSG_TEMPLATE_NOT_FOUND when template does not exist', async () => {
  templateRepo.findOne.mockResolvedValue(null);
  await expect(service.getTemplateByCode('UNKNOWN', 'app-id')).rejects.toMatchObject({
    errorCode: ErrorCode.MSG_TEMPLATE_NOT_FOUND,
  });
});
```

- [ ] **Step 4: message-request.service.ts 수정**

```typescript
// import 변경:
// 삭제: import { Injectable, InternalServerErrorException } from '@nestjs/common';
// 추가:
import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '@app/common';

// throw 교체 (4개):
// Kafka 발행 실패 (첫 번째, line ~147):
throw new InternalServerErrorException('메시지 요청 저장은 완료되었지만 Kafka 발행에 실패했습니다. 같은 requestId로 재시도하세요.');
→ throw new AppException(ErrorCode.MSG_KAFKA_PUBLISH_FAILED, 503);

// payload 없음 (line ~185):
throw new InternalServerErrorException('기존 요청의 payload를 찾을 수 없습니다.');
→ throw new AppException(ErrorCode.MSG_PAYLOAD_NOT_FOUND, 500);

// 데이터 누락 (line ~197):
throw new InternalServerErrorException('기존 요청의 channel/receiver/recipient 정보가 올바르지 않습니다.');
→ throw new AppException(ErrorCode.MSG_REQUEST_DATA_MISSING, 500);

// Kafka 재발행 실패 (line ~219):
throw new InternalServerErrorException('메시지 요청 저장은 완료되었지만 Kafka 발행에 실패했습니다. 같은 requestId로 재시도하세요.');
→ throw new AppException(ErrorCode.MSG_KAFKA_PUBLISH_FAILED, 503);
```

- [ ] **Step 5: message-request.service.spec.ts 업데이트**

```typescript
// import 변경:
// 삭제: import { InternalServerErrorException } from '@nestjs/common';
// 추가:
import { AppException, ErrorCode } from '@app/common';

// throw 검증 교체:
it('throws MSG_KAFKA_PUBLISH_FAILED when Kafka publish fails', async () => {
  kafkaService.publishMessageSend.mockRejectedValue(new Error('Kafka down'));
  await expect(service.send(auth, dto)).rejects.toMatchObject({
    errorCode: ErrorCode.MSG_KAFKA_PUBLISH_FAILED,
  });
});

it('throws MSG_PAYLOAD_NOT_FOUND when payload is missing during retry', async () => {
  const validatedRequest = makeSavedRequest({ status: MessageRequestStatus.VALIDATED });
  requestRepo.findOne.mockResolvedValue(validatedRequest);
  payloadRepo.findOne.mockResolvedValue(null);
  await expect(service.send(auth, dto)).rejects.toMatchObject({
    errorCode: ErrorCode.MSG_PAYLOAD_NOT_FOUND,
  });
});
```

- [ ] **Step 6: 전체 테스트 실행 — PASS 확인**

```bash
yarn test --no-coverage
```

예상: 모든 테스트 통과

- [ ] **Step 7: 커밋**

```bash
git add apps/admin-api/src/modules/client-api-key/client-api-key.service.ts \
        apps/api-gateway/src/modules/template/template.service.ts \
        apps/api-gateway/test/modules/template/template.service.spec.ts \
        apps/api-gateway/src/modules/message-request/message-request.service.ts \
        apps/api-gateway/test/modules/message-request/message-request.service.spec.ts
git commit -m "feat: Services — AppException + ErrorCode 교체 (ClientApiKey, Template, MessageRequest)"
```

---

## Task 7: README 최종 업데이트

**Files:**
- Modify: `README.md`

- [ ] **Step 1: What's Implemented 업데이트**

`| 프로덕션 하드닝 |` 행 뒤에 추가:

```markdown
| 에러 코드 표준화 | ✅ | 한국어 에러 코드 체계 (ErrorCode enum + ERROR_MESSAGES) — 모든 에러 응답에 `errorCode` 필드 |
```

- [ ] **Step 2: 테스트 수 업데이트**

```bash
yarn test --no-coverage 2>&1 | grep "Tests:"
```

나온 숫자로 README 업데이트.

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: 에러 코드 표준화 구현 완료 표시"
```

---

## 구현 후 확인 체크리스트

- [ ] `yarn test --no-coverage` 전체 통과
- [ ] API 에러 응답에 `errorCode`, `message`(한국어) 포함 확인
- [ ] `AppException` 5xx → 한국어 메시지 노출 (숨기지 않음) 확인
- [ ] 일반 `Error` → `errorCode: SYS_001`, 한국어 메시지 확인
- [ ] 일반 `HttpException` (class-validator 등) → `errorCode: null` 확인
