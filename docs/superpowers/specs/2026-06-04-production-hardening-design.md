# Production Hardening Design

**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** 애플리케이션 레이어 프로덕션 하드닝 — env 검증, 에러 응답 일관화, 보안 헤더

---

## Background

현재 코드베이스는 기능적으로 완성되어 있지만 실제 운영 환경에서 발생할 수 있는 3가지 문제가 있다:

1. **env var 오류**: `PAYLOAD_ENCRYPTION_KEY`가 빠지면 앱 시작 후 첫 요청 시 crash. DB 설정 오류는 첫 쿼리 시 crash. 빠를수록 좋은 fail-fast가 적용되어 있지 않음.
2. **에러 응답 불일치**: NestJS 기본 에러 형식(`{"statusCode":..,"message":..,"error":..}`)은 각 예외 타입마다 모양이 달라 클라이언트 파싱이 일관성 없음. 500 에러 스택트레이스가 로그에 남지 않음.
3. **보안 헤더**: HTTP 앱이 `X-Powered-By: Express` 등을 응답 헤더에 포함 — 서버 정보 노출.

---

## Decisions

| 항목 | 결정 |
|------|------|
| Env 검증 라이브러리 | `joi` (`@nestjs/config`의 `validationSchema` 옵션) |
| Env 검증 위치 | 각 앱 모듈의 `ConfigModule.forRoot()` |
| Exception Filter | `libs/common/src/filters/http-exception.filter.ts` — 공유 |
| 에러 응답 포맷 | `{ success: false, statusCode, message, path, timestamp }` |
| 보안 헤더 | `helmet` 패키지, HTTP 앱 `main.ts`에 `app.use(helmet())` |
| 적용 대상 앱 | api-gateway, admin-api, main, realtime-chat, worker-\* (모두 HTTP listen) |

---

## 에러 응답 포맷

### 4xx 클라이언트 에러 (HttpException)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "path": "/messages/send",
  "timestamp": "2026-06-04T09:00:00.000Z"
}
```
- `message`: `HttpException.getResponse()`에서 추출 (문자열이면 그대로, 객체면 `.message` 필드)
- 로그: debug 레벨 (4xx는 클라이언트 오류, 서버 오류 아님)

### 5xx 서버 에러 (Error / 알 수 없는 예외)
```json
{
  "success": false,
  "statusCode": 500,
  "message": "Internal server error",
  "path": "/messages/send",
  "timestamp": "2026-06-04T09:00:00.000Z"
}
```
- 실제 에러 메시지는 응답에 포함하지 않음 (정보 유출 방지)
- Logger로 `error` 레벨 스택트레이스 기록

---

## Env 검증 스키마

각 앱이 필요로 하는 env var를 Joi로 선언. `process.env` 직접 참조 대신 `ConfigService`를 사용하는 기존 코드는 변경 없음.

| 앱 | 필수 env var |
|----|------------|
| api-gateway | DB_\*, KAFKA_BROKERS, KAFKA_CLIENT_ID, REDIS_URL, PAYLOAD_ENCRYPTION_KEY |
| admin-api | DB_\* |
| main | DB_\*, KAFKA_BROKERS, PAYLOAD_ENCRYPTION_KEY |
| worker-\* | DB_\*, KAFKA_BROKERS, PAYLOAD_ENCRYPTION_KEY |
| realtime-chat | DB_\*, REDIS_URL |

`DB_*` = DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME

모두 기본값이 있으므로 `Joi.string().default(...)` 패턴. 단, `PAYLOAD_ENCRYPTION_KEY`는 기본값 없이 required.

---

## 패키지 설치

```bash
yarn add helmet joi
yarn add -D @types/helmet
```

---

## Component Changes

### 1. `HttpExceptionFilter` (신규, libs/common)

```
libs/common/src/filters/http-exception.filter.ts
libs/common/src/filters/index.ts
libs/common/test/filters/http-exception.filter.spec.ts
```

`@Catch()` 로 모든 예외 처리:
- `instanceof HttpException` → 상태코드 추출, 4xx는 debug log
- `instanceof Error` → 500, error log (스택트레이스)
- 기타 → 500, error log

`libs/common/src/index.ts`에 export 추가.

### 2. 각 앱 `main.ts`

```typescript
import helmet from 'helmet';
// ...
app.use(helmet());
app.useGlobalFilters(new HttpExceptionFilter());
```

`api-gateway`, `admin-api`, `main`, `realtime-chat`, `worker-email`, `worker-sms`, `worker-kakao` 7개 파일.

### 3. 각 앱 모듈 `ConfigModule.forRoot()`

```typescript
import * as Joi from 'joi';

ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DB_HOST: Joi.string().default('localhost'),
    // ...
    PAYLOAD_ENCRYPTION_KEY: Joi.string().required(),
  }),
  validationOptions: { allowUnknown: true },
})
```

`allowUnknown: true` — 앱마다 다른 env var가 있어도 검증 실패하지 않도록.

---

## Testing Strategy (TDD)

### `libs/common/test/filters/http-exception.filter.spec.ts` 신규

- `HttpException(400)` → `{ success: false, statusCode: 400 }` 응답
- `HttpException({ message: 'Validation...' })` → message 추출
- `Error('Unexpected')` → `{ statusCode: 500, message: 'Internal server error' }` 응답 (실제 에러 내용 숨김)
- 4xx → debug 로그 호출 확인
- 5xx → error 로그 호출 확인

---

## Out of Scope

- DB 마이그레이션 자동화
- Rate limiting 강화
- Circuit breaker
- Request timeout 미들웨어
- CORS 설정 (현재 기본값으로 동작)
