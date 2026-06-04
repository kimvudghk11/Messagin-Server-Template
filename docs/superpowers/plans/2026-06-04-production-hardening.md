# Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `helmet` 보안 헤더, Global HTTP Exception Filter, Joi env 검증을 모든 앱에 추가해 프로덕션 수준의 안정성과 보안을 확보한다.

**Architecture:** `HttpExceptionFilter`를 `libs/common`에 공유 필터로 생성하고 7개 앱 `main.ts`에 전역 등록. Joi 스키마는 각 앱 모듈의 `ConfigModule.forRoot()`에 인라인. `helmet`은 모든 HTTP 앱 부트스트랩에 미들웨어로 추가.

**Tech Stack:** `helmet`, `joi`, NestJS `@Catch()` ExceptionFilter, `@nestjs/config` validationSchema

---

## File Map

| Action | Path | 역할 |
|--------|------|------|
| Install | `package.json` | `helmet`, `joi`, `@types/helmet` 추가 |
| Create | `libs/common/src/filters/http-exception.filter.ts` | 공유 Global Exception Filter |
| Create | `libs/common/src/filters/index.ts` | filter exports |
| Create | `libs/common/test/filters/http-exception.filter.spec.ts` | 단위 테스트 |
| Modify | `libs/common/src/index.ts` | filters export 추가 |
| Modify | `apps/api-gateway/src/main.ts` | helmet + filter |
| Modify | `apps/api-gateway/src/api-gateway.module.ts` | Joi 검증 스키마 |
| Modify | `apps/admin-api/src/main.ts` | helmet + filter |
| Modify | `apps/admin-api/src/admin-api.module.ts` | Joi 검증 스키마 |
| Modify | `apps/main/src/main.ts` | helmet + filter |
| Modify | `apps/main/src/main.module.ts` | Joi 검증 스키마 |
| Modify | `apps/worker-email/src/main.ts` | helmet + filter |
| Modify | `apps/worker-email/src/worker-email.module.ts` | Joi 검증 스키마 |
| Modify | `apps/worker-sms/src/main.ts` | helmet + filter |
| Modify | `apps/worker-sms/src/worker-sms.module.ts` | Joi 검증 스키마 |
| Modify | `apps/worker-kakao/src/main.ts` | helmet + filter |
| Modify | `apps/worker-kakao/src/worker-kakao.module.ts` | Joi 검증 스키마 |
| Modify | `apps/realtime-chat/src/main.ts` | helmet + filter |
| Modify | `apps/realtime-chat/src/realtime-chat.module.ts` | Joi 검증 스키마 |
| Modify | `README.md` | 테스트 수 업데이트 |

---

## Task 1: 패키지 설치

**Files:**
- Modify: `package.json` (via yarn)

- [ ] **Step 1: helmet, joi, @types/helmet 설치**

```bash
yarn add helmet joi
yarn add -D @types/helmet
```

예상 출력: `success Saved X new dependencies`

- [ ] **Step 2: 설치 확인**

```bash
node -e "require('helmet'); require('joi'); console.log('OK')"
```

예상: `OK`

- [ ] **Step 3: 커밋**

```bash
git add package.json yarn.lock
git commit -m "chore: helmet, joi 패키지 설치"
```

---

## Task 2: HttpExceptionFilter (TDD)

**Files:**
- Create: `libs/common/test/filters/http-exception.filter.spec.ts`
- Create: `libs/common/src/filters/http-exception.filter.ts`
- Create: `libs/common/src/filters/index.ts`
- Modify: `libs/common/src/index.ts`

- [ ] **Step 1: 테스트 파일 작성**

`libs/common/test/filters/http-exception.filter.spec.ts`:

```typescript
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from '../../src/filters/http-exception.filter';

function makeHost(method = 'GET', url = '/test'): {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { method, url };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, json, status };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('HttpException (4xx)', () => {
    it('returns correct status and message for string response', () => {
      const { host, status, json } = makeHost();
      filter.catch(new HttpException('Bad request', HttpStatus.BAD_REQUEST), host);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 400,
          message: 'Bad request',
          path: '/test',
        }),
      );
    });

    it('extracts message from object response', () => {
      const { host, json } = makeHost();
      filter.catch(
        new HttpException({ message: 'Validation failed', error: 'Bad Request' }, 400),
        host,
      );

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Validation failed' }),
      );
    });

    it('logs at debug level for 4xx — not error level', () => {
      const { host } = makeHost();
      filter.catch(new HttpException('Not found', 404), host);

      expect(debugSpy).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('includes timestamp and path in response', () => {
      const { host, json } = makeHost('POST', '/messages/send');
      filter.catch(new HttpException('Forbidden', 403), host);

      const [call] = json.mock.calls;
      expect(call[0]).toHaveProperty('timestamp');
      expect(call[0]).toHaveProperty('path', '/messages/send');
    });
  });

  describe('Generic Error (5xx)', () => {
    it('returns 500 and hides actual error message', () => {
      const { host, status, json } = makeHost();
      filter.catch(new Error('Database connection failed'), host);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 500,
          message: 'Internal server error',
        }),
      );
    });

    it('logs at error level with stack trace for 5xx', () => {
      const { host } = makeHost();
      filter.catch(new Error('Unexpected crash'), host);

      expect(errorSpy).toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('handles non-Error throws gracefully', () => {
      const { host, status } = makeHost();
      filter.catch('plain string thrown', host);

      expect(status).toHaveBeenCalledWith(500);
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
yarn test libs/common/test/filters/http-exception.filter.spec.ts --no-coverage
```

예상: `Cannot find module '../../src/filters/http-exception.filter'`

- [ ] **Step 3: HttpExceptionFilter 구현**

`libs/common/src/filters/http-exception.filter.ts`:

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message } = this.resolveException(exception);

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
      statusCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveException(exception: unknown): { statusCode: number; message: string } {
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
      return { statusCode, message };
    }

    return { statusCode: 500, message: 'Internal server error' };
  }
}
```

- [ ] **Step 4: index 파일 생성**

`libs/common/src/filters/index.ts`:

```typescript
export * from './http-exception.filter';
```

- [ ] **Step 5: libs/common/src/index.ts에 export 추가**

`libs/common/src/index.ts` 마지막 줄에 추가:

```typescript
export * from './filters';
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
export * from './filters';
```

- [ ] **Step 6: 테스트 실행 — PASS 확인**

```bash
yarn test libs/common/test/filters/http-exception.filter.spec.ts --no-coverage
```

예상: 9개 테스트 통과

- [ ] **Step 7: 커밋**

```bash
git add libs/common/src/filters/ libs/common/test/filters/ libs/common/src/index.ts
git commit -m "feat: HttpExceptionFilter — 일관된 에러 응답 + 5xx 스택 로깅"
```

---

## Task 3: api-gateway — helmet + filter + Joi 검증

**Files:**
- Modify: `apps/api-gateway/src/main.ts`
- Modify: `apps/api-gateway/src/api-gateway.module.ts`

- [ ] **Step 1: api-gateway main.ts 수정**

`apps/api-gateway/src/main.ts` 전체:

```typescript
import { setupTracing } from '@app/common';

const sdk = setupTracing('api-gateway');

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ApiGatewayModule } from './api-gateway.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  app.use(helmet());

  const config = new DocumentBuilder()
    .setTitle('메시징 API 게이트웨이')
    .setDescription('메시지 요청 생성 및 템플릿 조회를 위한 API 게이트웨이')
    .setVersion('1.0.0')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-api-key' },
      'x-api-key',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-api-secret' },
      'x-api-secret',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
```

- [ ] **Step 2: api-gateway.module.ts — ConfigModule에 Joi 스키마 추가**

`apps/api-gateway/src/api-gateway.module.ts`에서 `ConfigModule` import 바로 아래에 추가:

```typescript
import * as Joi from 'joi';
```

`ConfigModule.forRoot({ isGlobal: true })` 를 다음으로 교체:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_USERNAME: Joi.string().default('postgres'),
    DB_PASSWORD: Joi.string().default('postgres'),
    DB_NAME: Joi.string().default('messaging'),
    KAFKA_BROKERS: Joi.string().default('localhost:9092'),
    KAFKA_CLIENT_ID: Joi.string().default('messaging-api-gateway'),
    REDIS_URL: Joi.string().default('redis://localhost:6379'),
    PAYLOAD_ENCRYPTION_KEY: Joi.string().required(),
  }),
  validationOptions: { allowUnknown: true },
}),
```

- [ ] **Step 3: 전체 테스트 실행 — 회귀 없음 확인**

```bash
yarn test --no-coverage
```

예상: 기존 테스트 + HttpExceptionFilter 9개 = 모두 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/api-gateway/src/main.ts apps/api-gateway/src/api-gateway.module.ts
git commit -m "feat: api-gateway — helmet + HttpExceptionFilter + Joi env 검증"
```

---

## Task 4: admin-api — helmet + filter + Joi 검증

**Files:**
- Modify: `apps/admin-api/src/main.ts`
- Modify: `apps/admin-api/src/admin-api.module.ts`

- [ ] **Step 1: admin-api main.ts 수정**

`apps/admin-api/src/main.ts` 전체:

```typescript
import { setupTracing } from '@app/common';

const sdk = setupTracing('admin-api');

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AdminApiModule } from './admin-api.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(AdminApiModule);
  app.use(helmet());

  const config = new DocumentBuilder()
    .setTitle('메시징 관리자 API')
    .setDescription('클라이언트, API Key, 운영 기능 관리를 위한 관리자 API')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
```

- [ ] **Step 2: admin-api.module.ts — Joi 스키마 추가**

`apps/admin-api/src/admin-api.module.ts`에 import 추가:

```typescript
import * as Joi from 'joi';
```

`ConfigModule.forRoot({ isGlobal: true })` 교체:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_USERNAME: Joi.string().default('postgres'),
    DB_PASSWORD: Joi.string().default('postgres'),
    DB_NAME: Joi.string().default('messaging'),
  }),
  validationOptions: { allowUnknown: true },
}),
```

- [ ] **Step 3: 커밋**

```bash
git add apps/admin-api/src/main.ts apps/admin-api/src/admin-api.module.ts
git commit -m "feat: admin-api — helmet + HttpExceptionFilter + Joi env 검증"
```

---

## Task 5: main 앱 — helmet + filter + Joi 검증

**Files:**
- Modify: `apps/main/src/main.ts`
- Modify: `apps/main/src/main.module.ts`

- [ ] **Step 1: main main.ts 수정**

`apps/main/src/main.ts` 전체:

```typescript
import { setupTracing } from '@app/common';

const sdk = setupTracing('main');

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { MainModule } from './main.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(MainModule);
  app.use(helmet());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
```

- [ ] **Step 2: main.module.ts — Joi 스키마 추가**

`apps/main/src/main.module.ts`에 import 추가:

```typescript
import * as Joi from 'joi';
```

`ConfigModule.forRoot({ isGlobal: true })` 교체:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_USERNAME: Joi.string().default('postgres'),
    DB_PASSWORD: Joi.string().default('postgres'),
    DB_NAME: Joi.string().default('messaging'),
    KAFKA_BROKERS: Joi.string().default('localhost:9092'),
    PAYLOAD_ENCRYPTION_KEY: Joi.string().required(),
  }),
  validationOptions: { allowUnknown: true },
}),
```

- [ ] **Step 3: 커밋**

```bash
git add apps/main/src/main.ts apps/main/src/main.module.ts
git commit -m "feat: main — helmet + HttpExceptionFilter + Joi env 검증"
```

---

## Task 6: worker 앱 3개 — helmet + filter + Joi 검증

**Files:**
- Modify: `apps/worker-email/src/main.ts`
- Modify: `apps/worker-email/src/worker-email.module.ts`
- Modify: `apps/worker-sms/src/main.ts`
- Modify: `apps/worker-sms/src/worker-sms.module.ts`
- Modify: `apps/worker-kakao/src/main.ts`
- Modify: `apps/worker-kakao/src/worker-kakao.module.ts`

- [ ] **Step 1: worker-email main.ts 수정**

`apps/worker-email/src/main.ts` 전체:

```typescript
import { setupTracing } from '@app/common';

const sdk = setupTracing('worker-email');

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { WorkerEmailModule } from './worker-email.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(WorkerEmailModule);
  app.use(helmet());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
```

- [ ] **Step 2: worker-email.module.ts — Joi 스키마 추가**

`apps/worker-email/src/worker-email.module.ts`에 import 추가:

```typescript
import * as Joi from 'joi';
```

`ConfigModule.forRoot({ isGlobal: true })` 교체:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_USERNAME: Joi.string().default('postgres'),
    DB_PASSWORD: Joi.string().default('postgres'),
    DB_NAME: Joi.string().default('messaging'),
    KAFKA_BROKERS: Joi.string().default('localhost:9092'),
    PAYLOAD_ENCRYPTION_KEY: Joi.string().required(),
  }),
  validationOptions: { allowUnknown: true },
}),
```

- [ ] **Step 3: worker-sms main.ts 수정**

`apps/worker-sms/src/main.ts` 전체:

```typescript
import { setupTracing } from '@app/common';

const sdk = setupTracing('worker-sms');

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { WorkerSmsModule } from './worker-sms.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(WorkerSmsModule);
  app.use(helmet());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
```

- [ ] **Step 4: worker-sms.module.ts — Joi 스키마 추가 (worker-email과 동일)**

`apps/worker-sms/src/worker-sms.module.ts`에 `import * as Joi from 'joi'` 추가 후 `ConfigModule.forRoot` 교체 (worker-email.module.ts Step 2와 동일한 스키마):

```typescript
import * as Joi from 'joi';
// ConfigModule.forRoot 교체:
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_USERNAME: Joi.string().default('postgres'),
    DB_PASSWORD: Joi.string().default('postgres'),
    DB_NAME: Joi.string().default('messaging'),
    KAFKA_BROKERS: Joi.string().default('localhost:9092'),
    PAYLOAD_ENCRYPTION_KEY: Joi.string().required(),
  }),
  validationOptions: { allowUnknown: true },
}),
```

- [ ] **Step 5: worker-kakao main.ts 수정**

`apps/worker-kakao/src/main.ts` 전체:

```typescript
import { setupTracing } from '@app/common';

const sdk = setupTracing('worker-kakao');

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { WorkerKakaoModule } from './worker-kakao.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(WorkerKakaoModule);
  app.use(helmet());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
```

- [ ] **Step 6: worker-kakao.module.ts — Joi 스키마 추가 (동일 스키마)**

`apps/worker-kakao/src/worker-kakao.module.ts`에 `import * as Joi from 'joi'` 추가 후 `ConfigModule.forRoot` 교체 (Step 2와 동일한 스키마):

```typescript
import * as Joi from 'joi';
// ConfigModule.forRoot 교체:
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_USERNAME: Joi.string().default('postgres'),
    DB_PASSWORD: Joi.string().default('postgres'),
    DB_NAME: Joi.string().default('messaging'),
    KAFKA_BROKERS: Joi.string().default('localhost:9092'),
    PAYLOAD_ENCRYPTION_KEY: Joi.string().required(),
  }),
  validationOptions: { allowUnknown: true },
}),
```

- [ ] **Step 7: 전체 테스트 실행 — 회귀 없음 확인**

```bash
yarn test --no-coverage
```

예상: 모든 테스트 통과

- [ ] **Step 8: 커밋**

```bash
git add apps/worker-email/ apps/worker-sms/ apps/worker-kakao/
git commit -m "feat: worker 3개 — helmet + HttpExceptionFilter + Joi env 검증"
```

---

## Task 7: realtime-chat — helmet + filter + Joi 검증

**Files:**
- Modify: `apps/realtime-chat/src/main.ts`
- Modify: `apps/realtime-chat/src/realtime-chat.module.ts`

- [ ] **Step 1: realtime-chat main.ts 수정**

`apps/realtime-chat/src/main.ts` 전체:

```typescript
import { setupTracing } from '@app/common';

const sdk = setupTracing('realtime-chat');

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { RealtimeChatModule } from './realtime-chat.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(RealtimeChatModule);
  app.use(helmet());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors();
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
```

- [ ] **Step 2: realtime-chat.module.ts — Joi 스키마 추가**

`apps/realtime-chat/src/realtime-chat.module.ts`에 import 추가:

```typescript
import * as Joi from 'joi';
```

`ConfigModule.forRoot({ isGlobal: true })` 교체:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_USERNAME: Joi.string().default('postgres'),
    DB_PASSWORD: Joi.string().default('postgres'),
    DB_NAME: Joi.string().default('messaging'),
    REDIS_URL: Joi.string().default('redis://localhost:6379'),
  }),
  validationOptions: { allowUnknown: true },
}),
```

- [ ] **Step 3: 최종 전체 테스트 실행**

```bash
yarn test --no-coverage
```

예상: 기존 122개 + HttpExceptionFilter 9개 = 131개 통과

실제 수 확인:
```bash
yarn test --no-coverage 2>&1 | grep "Tests:"
```

- [ ] **Step 4: 커밋**

```bash
git add apps/realtime-chat/src/main.ts apps/realtime-chat/src/realtime-chat.module.ts
git commit -m "feat: realtime-chat — helmet + HttpExceptionFilter + Joi env 검증"
```

---

## Task 8: README 업데이트

**Files:**
- Modify: `README.md`

- [ ] **Step 1: What's Implemented 업데이트**

`README.md`의 `| Admin 감사 로그 |` 행 뒤에 추가:

```markdown
| 프로덕션 하드닝 | ✅ | helmet 보안 헤더, Global HTTP Exception Filter, Joi env 검증 |
```

- [ ] **Step 2: 테스트 수 업데이트**

`**NNN개 단위 테스트**` 부분을 실제 테스트 수로 업데이트 (Task 7 Step 3에서 확인한 수).

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: 프로덕션 하드닝 구현 완료 표시, 테스트 수 업데이트"
```

---

## 구현 후 확인 체크리스트

- [ ] `yarn test --no-coverage` 전체 통과
- [ ] `HttpExceptionFilter` 9개 테스트 포함
- [ ] `node -e "require('helmet'); require('joi'); console.log('OK')"` 출력: `OK`
- [ ] api-gateway, admin-api, main, realtime-chat, worker-\* 7개 main.ts에 `helmet()` 추가됨
- [ ] 7개 앱 모듈에 Joi 검증 스키마 추가됨
- [ ] `PAYLOAD_ENCRYPTION_KEY` 없이 앱 시작 시 즉시 오류 발생 (fail-fast 검증)
