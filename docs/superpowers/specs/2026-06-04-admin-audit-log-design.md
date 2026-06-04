# Admin Audit Log Design

**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** Admin 액션 감사 로그 — `tb_admin_audit_log` 실제 기록 및 조회

---

## Background

`AdminAuditLogEntity`와 `AdminAuditLogEntity`에 필요한 enum(`AdminActionType`, `AdminTargetType`)이 이미 정의되어 있지만, 실제로 로그를 기록하는 코드가 없다. 현재 유일한 Admin 액션인 `POST /admin/client-apps/:id/api-keys`에 감사 로그를 연결하고, 관리자가 이력을 조회할 수 있는 엔드포인트를 추가한다.

---

## Decisions

| 항목 | 결정 |
|------|------|
| `adminUserId` 매핑 | `ClientApiKeyEntity.id` (인증된 Admin API Key의 UUID) |
| 로그 기록 위치 | Controller — request 컨텍스트가 있는 계층 |
| Guard 수정 | 인증 성공 후 `request['adminKeyId'] = apiKey.id` 설정 |
| IP 추출 | `request.ip` (Express 기본 값) |
| User-Agent | `request.headers['user-agent']` |
| 조회 엔드포인트 | `GET /admin/audit-logs` (페이지네이션, 최신순) |
| DB 마이그레이션 | 없음 — 엔티티 이미 존재 |

---

## Architecture

```
POST /admin/client-apps/:id/api-keys
  │ AdminAuthGuard
  │   └─ 인증 성공 → request['adminKeyId'] = apiKey.id
  │
  ├─ ClientApiKeyService.create()
  │    → savedApiKey
  │
  └─ AdminAuditLogService.log({
         adminKeyId: req['adminKeyId'],
         actionType: CREATE_API_KEY,
         targetType: API_KEY,
         targetId: savedApiKey.id,
         afterData: { keyId, keyName, keyType },
         ip: req.ip,
         userAgent: req.headers['user-agent'],
     })
       └─ AdminAuditLogEntity 저장

GET /admin/audit-logs
  └─ AdminAuditLogService.findAll(page, limit)
       └─ SELECT * ORDER BY created_at DESC LIMIT N OFFSET M
```

---

## Component Changes

### 1. `AdminAuthGuard` (apps/admin-api/src/guards/)

인증 성공 직전에 추가:
```typescript
(request as Record<string, unknown>)['adminKeyId'] = apiKey.id;
```

### 2. `AdminAuditLogService` (신규)

```typescript
interface AuditLogParams {
  adminKeyId: string;
  actionType: AdminActionType;
  targetType: AdminTargetType;
  targetId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
}

class AdminAuditLogService {
  async log(params: AuditLogParams): Promise<void>
  async findAll(page: number, limit: number): Promise<{ data, total, page, limit }>
}
```

### 3. `AdminAuditLogController` (신규)

```
GET /admin/audit-logs?page=1&limit=20
```

`AdminAuthGuard` 적용.

### 4. `ClientApiKeyController` (수정)

- 메서드 시그니처에 `@Req() req: Request` 추가
- `service.create()` 반환 후 `auditLogService.log()` 호출

### 5. `AdminAuditLogModule` (신규)

- `providers: [AdminAuditLogService, AdminAuthGuard]`
- `exports: [AdminAuditLogService]`
- `controllers: [AdminAuditLogController]`
- `imports: [TypeOrmModule.forFeature([AdminAuditLogEntity, ClientAppEntity, ClientApiKeyEntity])]`

### 6. `ClientApiKeyModule` (수정)

- `imports`에 `AdminAuditLogModule` 추가

### 7. `AdminApiModule` (수정)

- `TypeOrmModule.forRoot`에 `AdminAuditLogEntity` 추가
- `imports`에 `AdminAuditLogModule` 추가

---

## Entity 필드 매핑

| Entity 필드 | 소스 |
|------------|------|
| `adminUserId` | `request['adminKeyId']` (= `apiKey.id`) |
| `actionType` | 하드코딩 (예: `AdminActionType.CREATE_API_KEY`) |
| `targetType` | 하드코딩 (예: `AdminTargetType.API_KEY`) |
| `targetId` | 생성된 entity의 UUID |
| `beforeData` | null (create 액션은 이전 데이터 없음) |
| `afterData` | 생성된 key의 공개 필드 (plainSecret 제외) |
| `ipAddress` | `request.ip` |
| `userAgent` | `request.headers['user-agent']` |

---

## Testing Strategy (TDD)

### `admin-auth.guard.spec.ts` 업데이트

- 인증 성공 시 `request['adminKeyId']`가 `'admin-key-uuid'`로 설정되는지 확인

### `admin-audit-log.service.spec.ts` 신규

- `log()` — `AdminAuditLogEntity` 저장 시 모든 필드 올바르게 매핑
- `findAll()` — 페이지네이션 (skip/take) 올바르게 적용

### `admin-audit-log.controller.spec.ts` 신규

- `GET /admin/audit-logs` — `findAll` 호출 및 결과 반환
- `limit` 최대 100 클램핑

---

## Out of Scope

- 필터링 (actionType, targetType, 날짜 범위 — 지금은 전체 조회만)
- 로그 삭제 / TTL
- Kafka 연동 (audit log를 Kafka로 스트리밍)
- 현재 구현되지 않은 Admin 액션들 (템플릿 CRUD 등)에 대한 로그
