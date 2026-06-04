# Error Code Standardization Design

**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** 한국어 에러 코드 체계 — enum + 메시지 맵 + AppException + 전체 throw 사이트 교체

---

## Background

현재 예외 응답은 영어 문자열이 산발적으로 흩어져 있고, 클라이언트 입장에서 에러 원인을 프로그래밍 방식으로 식별할 방법이 없다:

```json
// 현재 (일관성 없음)
{ "statusCode": 401, "message": "Invalid API key", "error": "Unauthorized" }
{ "statusCode": 403, "message": "Permission denied: SEND_MESSAGE" }
{ "statusCode": 500, "message": "Internal server error" }
```

목표:

```json
// 목표 (일관됨 + 한국어 + 식별 가능)
{ "success": false, "errorCode": "AUTH_002", "message": "유효하지 않은 API 키입니다.", "path": "/...", "timestamp": "..." }
{ "success": false, "errorCode": "PERM_001", "message": "해당 작업에 대한 권한이 없습니다.", "path": "/...", "timestamp": "..." }
```

---

## Decisions

| 항목 | 결정 |
|------|------|
| 에러 코드 형식 | `도메인_XXX` (예: `AUTH_001`, `MSG_003`) |
| 메시지 언어 | 한국어 |
| 저장 형식 | TypeScript enum + Record (타입 안전) |
| 커스텀 예외 클래스 | `AppException extends HttpException` |
| 5xx AppException | 메시지 숨기지 않음 — AppException은 운영자가 의도한 메시지 |
| 5xx 일반 Error | 메시지 숨김 + `SYS_001` 코드 부여 |

---

## Error Code 체계

```typescript
// libs/common/src/errors/error-code.enum.ts
export enum ErrorCode {
  // 인증 (AUTH)
  AUTH_MISSING_HEADERS = 'AUTH_001',    // x-api-key / x-api-secret 누락
  AUTH_INVALID_API_KEY = 'AUTH_002',    // 존재하지 않는 키
  AUTH_API_KEY_INACTIVE = 'AUTH_003',   // 비활성화된 키
  AUTH_API_KEY_EXPIRED = 'AUTH_004',    // 만료된 키
  AUTH_INVALID_SECRET = 'AUTH_005',     // 시크릿 불일치
  AUTH_CLIENT_APP_INACTIVE = 'AUTH_006',// 비활성화된 클라이언트 앱
  AUTH_ADMIN_REQUIRED = 'AUTH_007',     // ADMIN 키 필요
  AUTH_IP_NOT_ALLOWED = 'AUTH_008',     // IP 화이트리스트 차단

  // 권한 (PERM)
  PERM_INSUFFICIENT = 'PERM_001',       // 권한 부족

  // 요청 한도 (RATE)
  RATE_LIMIT_EXCEEDED = 'RATE_001',     // 분당 한도 초과

  // 메시지 (MSG)
  MSG_TEMPLATE_NOT_FOUND = 'MSG_001',   // 템플릿 없음
  MSG_TEMPLATE_ACCESS_DENIED = 'MSG_002', // 템플릿 접근 불가
  MSG_INVALID_VARIABLES = 'MSG_003',    // 변수 검증 실패
  MSG_PAYLOAD_NOT_FOUND = 'MSG_004',    // Payload 없음
  MSG_REQUEST_DATA_MISSING = 'MSG_005', // 재시도 시 데이터 누락
  MSG_KAFKA_PUBLISH_FAILED = 'MSG_006', // Kafka 발행 실패 (재시도 안내)

  // 클라이언트 앱 (CLIENT)
  CLIENT_APP_NOT_FOUND = 'CLIENT_001',  // 앱 없음

  // 시스템 (SYS)
  SYS_INTERNAL_ERROR = 'SYS_001',      // 예상치 못한 서버 오류
}
```

---

## 에러 메시지 맵 (한국어)

```typescript
// libs/common/src/errors/error-messages.ts
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

---

## AppException 클래스

```typescript
// libs/common/src/errors/app.exception.ts
export class AppException extends HttpException {
  readonly errorCode: ErrorCode;

  constructor(errorCode: ErrorCode, statusCode: number) {
    super({ errorCode, message: ERROR_MESSAGES[errorCode] }, statusCode);
    this.errorCode = errorCode;
  }
}
```

---

## HttpExceptionFilter 업데이트

`AppException` → `errorCode` 포함, `ERROR_MESSAGES`에서 한국어 메시지  
일반 `HttpException` (NestJS 기본) → `errorCode: null`  
일반 `Error` → `errorCode: SYS_001`, 한국어 시스템 오류 메시지

```json
// AppException 응답
{ "success": false, "errorCode": "AUTH_002", "message": "유효하지 않은 API 키입니다.", "path": "...", "timestamp": "..." }

// 일반 HttpException 응답 (class-validator 등)
{ "success": false, "errorCode": null, "message": "name should not be empty", "path": "...", "timestamp": "..." }

// 5xx 시스템 오류 응답
{ "success": false, "errorCode": "SYS_001", "message": "일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.", "path": "...", "timestamp": "..." }
```

---

## Throw 사이트 교체 대상 (23개)

| 파일 | 기존 | 교체 코드 |
|------|------|---------|
| `admin-auth.guard.ts:23` | `UnauthorizedException('Missing API key headers')` | `AppException(AUTH_MISSING_HEADERS, 401)` |
| `admin-auth.guard.ts:28` | `UnauthorizedException('Invalid API key')` | `AppException(AUTH_INVALID_API_KEY, 401)` |
| `admin-auth.guard.ts:32` | `UnauthorizedException('Admin access required')` | `AppException(AUTH_ADMIN_REQUIRED, 401)` |
| `admin-auth.guard.ts:36` | `UnauthorizedException('API key is not active')` | `AppException(AUTH_API_KEY_INACTIVE, 401)` |
| `admin-auth.guard.ts:40` | `UnauthorizedException('API key expired')` | `AppException(AUTH_API_KEY_EXPIRED, 401)` |
| `admin-auth.guard.ts:48` | `UnauthorizedException('Invalid API secret')` | `AppException(AUTH_INVALID_SECRET, 401)` |
| `admin-auth.guard.ts:53` | `UnauthorizedException('Client app is not active')` | `AppException(AUTH_CLIENT_APP_INACTIVE, 401)` |
| `client-api-key.service.ts:25` | `NotFoundException('Client app not found')` | `AppException(CLIENT_APP_NOT_FOUND, 404)` |
| `client-permission.guard.ts:31` | `ForbiddenException(...)` | `AppException(PERM_INSUFFICIENT, 403)` |
| `rate-limit.guard.ts:35` | `HttpException('Too many requests', 429)` | `AppException(RATE_LIMIT_EXCEEDED, 429)` |
| `client-auth.service.ts:43` | `UnauthorizedException('Missing API key headers')` | `AppException(AUTH_MISSING_HEADERS, 401)` |
| `client-auth.service.ts:48` | `UnauthorizedException('Invalid API key')` | `AppException(AUTH_INVALID_API_KEY, 401)` |
| `client-auth.service.ts:52` | `UnauthorizedException('API key is not active')` | `AppException(AUTH_API_KEY_INACTIVE, 401)` |
| `client-auth.service.ts:56` | `UnauthorizedException('API key expired')` | `AppException(AUTH_API_KEY_EXPIRED, 401)` |
| `client-auth.service.ts:64` | `UnauthorizedException('Invalid API secret')` | `AppException(AUTH_INVALID_SECRET, 401)` |
| `client-auth.service.ts:69` | `UnauthorizedException('Client app is not active')` | `AppException(AUTH_CLIENT_APP_INACTIVE, 401)` |
| `client-auth.service.ts:107` | `UnauthorizedException('IP address not allowed')` | `AppException(AUTH_IP_NOT_ALLOWED, 401)` |
| `message-request.service.ts:147` | `InternalServerErrorException('Kafka 발행 실패')` | `AppException(MSG_KAFKA_PUBLISH_FAILED, 503)` |
| `message-request.service.ts:185` | `InternalServerErrorException('payload 없음')` | `AppException(MSG_PAYLOAD_NOT_FOUND, 500)` |
| `message-request.service.ts:197` | `InternalServerErrorException('데이터 누락')` | `AppException(MSG_REQUEST_DATA_MISSING, 500)` |
| `message-request.service.ts:219` | `InternalServerErrorException('Kafka 재발행 실패')` | `AppException(MSG_KAFKA_PUBLISH_FAILED, 503)` |
| `template.service.ts:28` | `NotFoundException('Template not found')` | `AppException(MSG_TEMPLATE_NOT_FOUND, 404)` |
| `template.service.ts:90` | `NotFoundException('Template not found')` | `AppException(MSG_TEMPLATE_NOT_FOUND, 404)` |

---

## 테스트 업데이트 전략

기존 테스트가 `new UnauthorizedException('Invalid API key')` 매칭 → `AppException` 인스턴스 체크로 변경:

```typescript
// 기존
await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);

// 변경
await expect(guard.canActivate(ctx)).rejects.toMatchObject({
  errorCode: ErrorCode.AUTH_INVALID_API_KEY,
});
```

또는 `instanceof AppException` 체크 + `errorCode` 검증.

---

## Out of Scope

- 성공 응답 래핑 (`{ success: true, data: ... }`) — API 계약 파괴 위험
- 에러 로그 알림 (Slack, PagerDuty)
- 에러 코드 API 문서 자동 생성
