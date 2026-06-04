# Messaging Server Template

NestJS 모노레포 기반 **멀티채널 메시징 플랫폼 템플릿**입니다.

---

## Why This Project

회사에서 메시징 서비스를 기존 백엔드 레포 중 하나에 급하게 추가했다가 과부하가 한 서비스에 몰리는 문제를 경험했습니다. 메시징은 트래픽 특성이 달라 별도 서비스로 분리되어야 하고, Kafka 기반 비동기 처리로 채널별 워커를 독립 스케일아웃하는 구조가 필요하다는 걸 체득했습니다.

Kafka를 직접 공부하면서, 다음에 같은 상황이 왔을 때 바로 꺼내 쓸 수 있는 **프로덕션 지향 템플릿**으로 정리한 프로젝트입니다.

단순 CRUD가 아니라 **요청 추적 → 비동기 발송 → 상태 업데이트 → 감사 로그 → 장애 복구**까지 갖춘 구조를 목표로 합니다.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     External Service                    │
│              (x-api-key / x-api-secret 인증)             │
└─────────────────────┬───────────────────────────────────┘
                      │ POST /messages/send
                      ▼
┌─────────────────────────────────────────────────────────┐
│                     api-gateway  :3000                  │
│  · ClientAuthGuard (IP 화이트리스트 + timingSafeEqual)    │
│  · RateLimitGuard (분당 요청 한도, Redis 슬라이딩 윈도우)    │
│  · ClientPermissionGuard (SEND_MESSAGE 권한 체크)         │
│  · 템플릿 변수 검증                                        │
│  · MessageRequest / Payload / Recipient + Outbox DB 저장 │
│  · Kafka topic: message.send 발행                        │
└──────────┬──────────────────────────────────────────────┘
           │ Kafka (+ Outbox relay 보장)
   ┌───────┼───────┐
   ▼       ▼       ▼
worker  worker  worker      ← 채널 필터링 / 지수 백오프 재시도
-email  -sms   -kakao        (RETRY_WAIT → nextRetryAt 기반)
   └───────┴───────┘
           │ MessageDispatch / Log DB 저장
           ▼
   MessageRequest.status = COMPLETED

┌─────────────────────────────────────────────────────────┐
│                        main                             │
│  · RetrySchedulerService (매 1분 RETRY_WAIT 재발행)       │
│  · OutboxRelayService (매 30초 PENDING Outbox 재발행)     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  admin-api  :3001                       │
│  · AdminAuthGuard (ADMIN keyType 전용)                   │
│  · 클라이언트 앱 / API Key 발급 관리                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                realtime-chat  :3001                     │
│  · WebSocket Gateway (/chat namespace)                  │
│  · joinRoom / leaveRoom / sendMessage 이벤트             │
│  · ChatRoomService: DB 저장 + 실시간 브로드캐스트           │
│  · WsAuthService: handshake x-api-key 검증               │
│  · POST /chat/rooms/:roomId/read (읽음 처리)             │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| 영역 | 기술 |
|------|------|
| Runtime | Node.js (LTS) |
| Language | TypeScript (strict mode) |
| Framework | NestJS 11 |
| Database | PostgreSQL + TypeORM |
| Messaging | Apache Kafka (kafkajs) |
| Cache / Rate Limit | Redis (ioredis, sorted set sliding window) |
| Realtime | Socket.IO (WebSocket Gateway) |
| Validation | class-validator, class-transformer |
| Tracing | OpenTelemetry SDK → Jaeger (OTLP HTTP) |
| Metrics | Prometheus (prom-client, /metrics 엔드포인트) |
| Test | Jest + @nestjs/testing |
| Tooling | ESLint Flat Config, Prettier, Yarn |

---

## Monorepo Structure

```
apps/
  api-gateway/       # 외부 메시지 요청 수신 · 검증 · Kafka 발행 (포트 3000)
  admin-api/         # 관리자 전용 API — API Key 발급, 클라이언트 앱 관리 (포트 3001)
  worker-email/      # Email 채널 Kafka consumer
  worker-sms/        # SMS 채널 Kafka consumer
  worker-kakao/      # Kakao 채널 Kafka consumer
  realtime-chat/     # WebSocket 실시간 채팅 서버 (포트 3001, 독립 확장 가능)
  main/              # RetryScheduler + OutboxRelay 스케줄러 호스트

libs/
  database/          # TypeORM Entity / Enum 단일 진실 공급원
  contracts/         # Kafka Event 계약 타입 (Producer ↔ Consumer 공유)
  kafka/             # KafkaService (Producer) 공통 추상화
  auth/              # 인증 공통 확장 지점
  common/            # 범용 유틸리티 (tracing, testing helpers, CLS logger)
```

---

## Key Design Decisions

### 멱등성(Idempotency) 보장

`requestId`를 클라이언트가 직접 지정합니다. 동일 `requestId`로 재요청 시:

- `VALIDATED` 상태 → Kafka 장애 복구 재시도, 재발행
- `QUEUED` / `PROCESSING` / `COMPLETED` / `FAILED` → 현재 상태 그대로 반환 (재처리 없음)

### API Key 인증 보안

- **타이밍 공격 방어**: `crypto.timingSafeEqual`로 해시 비교
- **IP 화이트리스트**: `isIpWhitelistEnabled=true`인 앱은 PostgreSQL `cidr` 타입으로 CIDR 범위 매칭
- **X-Forwarded-For 처리**: 프록시 뒤 클라이언트 IP 정확히 추출
- **키 분리**: `SERVER` / `ADMIN` / `WORKER` 타입으로 권한 분리

### Outbox 패턴

메시지 발송 요청 시 DB 트랜잭션 안에서 `tb_message_outbox`에 이벤트를 함께 저장합니다. Kafka 발행에 실패해도 `PENDING` 상태의 Outbox 레코드가 남아있고, `OutboxRelayService`가 30초마다 재발행합니다. DB 커밋과 Kafka 발행이 원자적으로 묶입니다.

### 채널별 워커 분리

Email / SMS / Kakao 워커가 동일 Kafka 토픽을 구독하고 `channel` 필드로 필터링합니다. 채널마다 독립적으로 스케일아웃할 수 있고, 한 채널 장애가 다른 채널에 영향을 주지 않습니다.

### 지수 백오프 재시도

워커 처리 실패 시 `nextRetryAt`을 계산해 `RETRY_WAIT` 상태로 전환합니다. `RetrySchedulerService`가 매 1분마다 `nextRetryAt` 이 지난 디스패치를 Kafka에 재발행합니다 (1분 → 5분 → 15분).

---

## Database Schema

| 도메인 | 주요 테이블 |
|--------|------------|
| Client Auth | `tb_client_app`, `tb_client_api_key`, `tb_client_permission`, `tb_client_channel_policy`, `tb_client_ip_whitelist` |
| Template | `tb_message_template`, `tb_message_template_channel`, `tb_message_template_variable`, `tb_client_template_access` |
| Message | `tb_message_request`, `tb_message_payload`, `tb_message_recipient`, `tb_message_dispatch`, `tb_message_dispatch_log` |
| Outbox | `tb_message_outbox` |
| Admin Audit | `tb_admin_audit_log` |
| Chat | `tb_chat_room`, `tb_chat_room_participant`, `tb_chat_message`, `tb_chat_message_read`, `tb_chat_attachment` |

모든 테이블은 `timestamptz` 기반 `BaseTimeEntity` / `BaseCreatedAtEntity`를 상속해 타임존 일관성을 유지합니다.

---

## What's Implemented

| 기능 | 상태 | 설명 |
|------|------|------|
| API Key 인증 | ✅ | timingSafeEqual + IP 화이트리스트 (CIDR) + X-Forwarded-For |
| Admin 인증 가드 | ✅ | ADMIN keyType 전용 접근 제어 |
| 권한 체크 | ✅ | `@RequirePermission()` 데코레이터 + DB 조회 |
| Rate Limiting | ✅ | Redis sorted set 슬라이딩 윈도우, 멀티 인스턴스 지원 |
| Request Tracing | ✅ | `x-request-id` 헤더 전파 + nestjs-cls AsyncLocalStorage |
| 멱등성 보장 | ✅ | requestId 기반 중복 요청 처리 (상태별 분기) |
| Outbox 패턴 | ✅ | 발송 요청 시 Outbox 기록, 30초마다 Relay |
| 재시도 스케줄러 | ✅ | 매 1분 RETRY_WAIT 디스패치 재발행 |
| 지수 백오프 | ✅ | 1분 → 5분 → 15분 재시도 간격 |
| 채널별 Worker | ✅ | Email / SMS / Kakao 독립 Kafka Consumer |
| Realtime Chat | ✅ | WebSocket Gateway + API key 인증 + 읽음 처리 API |
| Docker Compose | ✅ | PostgreSQL + Zookeeper + Kafka + Redis + Jaeger |
| 분산 트레이싱 | ✅ | OpenTelemetry → Jaeger (HTTP, Express, Kafka, PostgreSQL 자동 계측) |
| Prometheus 메트릭 | ✅ | HTTP 요청수/응답시간 인터셉터, `/metrics` 엔드포인트 |
| TypeORM Migration | ✅ | `libs/database/src/data-source.ts` + migration 스크립트 |
| 페이로드 암호화 | ✅ | AES-256-GCM 필드 레벨 암호화 — DB + Kafka 보호, PII 마스킹 감사 뷰 |
| Admin 감사 로그 | ✅ | API Key 발급 시 `tb_admin_audit_log` 기록, `GET /admin/audit-logs` 조회 |
| 프로덕션 하드닝 | ✅ | Joi env 검증 (시작 시 fail-fast), helmet 보안 헤더, Global HTTP Exception Filter |

---

## Getting Started

### Prerequisites

- Node.js LTS
- Yarn 1.x
- Docker (PostgreSQL + Kafka + Redis + Jaeger 포함)

### 1. 의존성 설치

```bash
yarn install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
# .env에서 DB / Kafka / Redis 연결 정보 확인 (기본값으로 Docker Compose와 맞춰져 있음)
```

### 3. 인프라 실행

```bash
docker-compose up -d
# PostgreSQL(:5432), Zookeeper(:2181), Kafka(:9092), Redis(:6379), Jaeger(:16686, :4318) 실행
```

### 4. 앱 실행

각 앱은 `PORT` 환경변수를 읽습니다. 로컬에서 동시에 실행할 때는 포트가 겹치지 않게 설정하세요.

```bash
# api-gateway (기본 포트 3000)
yarn start api-gateway

# admin-api (포트 3001 권장)
PORT=3001 yarn start admin-api

# 채널별 워커 (포트 불필요)
yarn start worker-email
yarn start worker-sms
yarn start worker-kakao

# 재시도 스케줄러 + Outbox Relay
yarn start main

# 실시간 채팅 (기본 포트 3001)
yarn start realtime-chat
```

### Swagger

| 앱 | URL |
|----|-----|
| api-gateway | `http://localhost:3000/docs` |
| admin-api | `http://localhost:3001/docs` |

### 모니터링

| 도구 | URL | 설명 |
|------|-----|------|
| Jaeger UI | `http://localhost:16686` | 분산 트레이싱 시각화 |
| api-gateway Metrics | `http://localhost:3000/metrics` | Prometheus 메트릭 |
| admin-api Metrics | `http://localhost:3001/metrics` | Prometheus 메트릭 |

> **tracing 비활성화**: `.env`에서 `OTEL_ENABLED=false` 설정 시 OpenTelemetry SDK가 no-op 모드로 동작합니다.

---

## Testing

### 테스트 실행

```bash
yarn test          # 전체 단위 테스트
yarn test:watch    # watch 모드
yarn test:cov      # 커버리지 포함
```

현재 **130개 단위 테스트** 통과 (Jest + @nestjs/testing, 실제 DB 없이 mock 기반)

### 테스트 구조

각 앱/라이브러리 내부에 `src/`와 나란히 `test/` 폴더를 두고, 소스 디렉터리 구조를 그대로 미러링합니다.

```
apps/api-gateway/
  src/
    guards/rate-limit.guard.ts
    modules/auth/client-auth.service.ts
  test/
    guards/rate-limit.guard.spec.ts
    modules/auth/client-auth.service.spec.ts
```

### 주요 테스트 대상

| 테스트 파일 | 검증 내용 |
|------------|----------|
| `api-gateway/test/modules/message-request/validator/` | 7가지 데이터 타입 변수 검증 로직 |
| `api-gateway/test/modules/auth/` | 인증 플로우 전체 (IP 화이트리스트 포함) |
| `admin-api/test/guards/` | ADMIN keyType 전용 접근 제어 |
| `api-gateway/test/guards/rate-limit.guard.spec.ts` | 분당 한도 초과 / 클라이언트별 독립 추적 |
| `api-gateway/test/guards/client-permission.guard.spec.ts` | 권한 있음/없음/불필요 케이스 |
| `api-gateway/test/modules/template/` | PUBLIC / PRIVATE / RESTRICTED 접근 범위 |
| `api-gateway/test/modules/message-request/` | 신규 요청 / Outbox 기록 / Kafka 실패 / 멱등 재시도 |
| `libs/kafka/test/` | Producer lifecycle / 토픽·키 검증 |
| `main/test/modules/outbox-relay/` | PENDING 이벤트 발행 / 실패 처리 / 다중 이벤트 |
| `main/test/modules/retry-scheduler/` | RETRY_WAIT 재발행 / 데이터 누락 시 FAILED 처리 |
| `libs/common/test/tracing/` | OpenTelemetry SDK 초기화 / 환경변수 분기 |

---

## API Overview

### api-gateway `:3000`

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/messages/send` | 메시지 발송 요청 (멱등, requestId 기반) |
| `GET` | `/templates/:code` | 템플릿 단건 조회 |
| `GET` | `/templates/:code/variables` | 템플릿 변수 목록 |
| `GET` | `/clients/templates` | 클라이언트가 사용 가능한 템플릿 목록 |

모든 엔드포인트는 `x-api-key` / `x-api-secret` 헤더 인증 필요 (`SERVER` 타입 키)

### admin-api `:3001`

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/admin/client-apps/:id/api-keys` | API Key 발급 |

`AdminAuthGuard` 적용 — `ApiKeyType.ADMIN` 키만 접근 가능

### realtime-chat `:3001`

| Method / Event | Path / Event | 설명 |
|----------------|-------------|------|
| `GET` | `/health` | 헬스체크 |
| `POST` | `/chat/rooms/:roomId/read` | 읽음 처리 |
| WebSocket | `joinRoom` | 채팅방 입장 |
| WebSocket | `leaveRoom` | 채팅방 퇴장 |
| WebSocket | `sendMessage` | 메시지 전송 (DB 저장 + 브로드캐스트) |

WebSocket handshake 시 `x-api-key` / `x-api-secret` 헤더로 인증 (`WsAuthService`)

---

## Future Improvements

- [ ] E2E / 통합 테스트 — 실제 DB + Kafka 연동 테스트
- [ ] WebSocket 부하 테스트 및 수평 확장 검증 (Redis Pub/Sub Adapter)
- [ ] Dead Letter Queue — 최대 재시도 초과 시 DLQ 토픽 전송 (설계·플랜 완료, 구현 예정)
- [x] 메시지 암호화 — payload 필드 레벨 암호화 (`PayloadEncryptionStatus.ENCRYPTED`)
- [x] Admin 감사 로그 — `tb_admin_audit_log` 실제 기록
- [ ] E2E / 통합 테스트 — 실제 DB + Kafka 연동 테스트
- [ ] WebSocket 수평 확장 — Redis Pub/Sub Adapter (Socket.IO 멀티 인스턴스)
