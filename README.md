# Messaging Server Template

NestJS 모노레포 기반 **멀티채널 메시징 플랫폼 템플릿**입니다.

외부 시스템이 API를 통해 메시지 발송을 요청하면, Kafka를 통해 채널별 워커(Email / SMS / Kakao)가 비동기로 처리합니다.
단순 CRUD가 아닌 **요청 추적 → 비동기 발송 → 상태 업데이트 → 감사 로그**까지 갖춘 프로덕션 지향 구조를 목표로 합니다.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     External Service                     │
│              (x-api-key / x-api-secret 인증)             │
└─────────────────────┬───────────────────────────────────┘
                      │ POST /messages/send
                      ▼
┌─────────────────────────────────────────────────────────┐
│                     api-gateway                          │
│  · ClientAuthGuard (IP 화이트리스트 + timingSafeEqual)    │
│  · RateLimitGuard (분당 요청 한도)                        │
│  · ClientPermissionGuard (SEND_MESSAGE 권한 체크)         │
│  · 템플릿 변수 검증                                        │
│  · MessageRequest / Payload / Recipient + Outbox DB 저장  │
│  · Kafka topic: message.send 발행                         │
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
│                        main                              │
│  · RetrySchedulerService (매 1분 RETRY_WAIT 재발행)      │
│  · OutboxRelayService (매 30초 PENDING Outbox 재발행)    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     admin-api                            │
│  · AdminAuthGuard (ADMIN keyType 전용)                   │
│  · 클라이언트 앱 / API Key 발급 관리                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   realtime-chat                          │
│  · WebSocket Gateway (/chat namespace)                   │
│  · joinRoom / leaveRoom / sendMessage 이벤트             │
│  · ChatRoomService: DB 저장 + 실시간 브로드캐스트          │
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
| Validation | class-validator, class-transformer |
| Test | Jest + @nestjs/testing |
| Tooling | ESLint Flat Config, Prettier, Yarn |

---

## Monorepo Structure

```
apps/
  api-gateway/       # 외부 메시지 요청 수신 · 검증 · Kafka 발행
  admin-api/         # 관리자 전용 API (API Key 발급, 앱 관리)
  worker-email/      # Email 채널 Kafka consumer
  worker-sms/        # SMS 채널 Kafka consumer
  worker-kakao/      # Kakao 채널 Kafka consumer
  realtime-chat/     # 실시간 채팅 도메인 (독립 확장 예정)
  main/              # 공통 부트스트랩 실험용

libs/
  database/          # TypeORM Entity / Enum 단일 진실 공급원
  contracts/         # Kafka Event 계약 타입 (Producer ↔ Consumer 공유)
  kafka/             # KafkaService (Producer) 공통 추상화
  auth/              # 인증 공통 확장 지점
  common/            # 범용 유틸리티
```

---

## Key Design Decisions

### 멱등성(Idempotency) 보장
`requestId`를 클라이언트가 직접 지정합니다. 동일 `requestId`가 재요청되면 Kafka 장애 복구 재시도(`VALIDATED` 상태)만 재발행하고, 이미 처리 중이거나 완료된 요청은 현재 상태를 그대로 반환합니다.

### API Key 인증 보안
- **타이밍 공격 방어**: `crypto.timingSafeEqual`로 해시 비교
- **IP 화이트리스트**: `isIpWhitelistEnabled=true`인 앱은 PostgreSQL `cidr` 타입으로 CIDR 범위 매칭
- **키 분리**: `SERVER` / `ADMIN` / `WORKER` 타입으로 권한 분리

### Outbox 패턴 (설계 완료, 구현 예정)
`tb_message_outbox` 테이블이 설계되어 있습니다. Kafka 장애 시에도 DB 트랜잭션으로 이벤트를 보존하고, 별도 Relay 프로세스가 발행을 보장하는 구조로 확장 예정입니다.

### 채널별 워커 분리
Email / SMS / Kakao 워커가 동일 Kafka 토픽을 구독하고 채널 필드로 필터링합니다. 채널마다 독립적으로 스케일아웃할 수 있고, 한 채널 장애가 다른 채널에 영향을 주지 않습니다.

---

## Database Schema Overview

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
| API Key 인증 | ✅ | timingSafeEqual + IP 화이트리스트 (CIDR) |
| Admin 인증 가드 | ✅ | ADMIN keyType 전용 접근 제어 |
| 권한 체크 | ✅ | `@RequirePermission()` 데코레이터 + DB 조회 |
| Rate Limiting | ✅ | 인메모리 슬라이딩 윈도우, 클라이언트별 분리 |
| Request Tracing | ✅ | `x-request-id` 헤더 전파 미들웨어 |
| 멱등성 보장 | ✅ | requestId 기반 중복 요청 처리 |
| Outbox 패턴 | ✅ | 발송 요청 시 Outbox 기록, 30초마다 Relay |
| 재시도 스케줄러 | ✅ | 매 1분 RETRY_WAIT 디스패치 재발행 |
| 지수 백오프 | ✅ | 1분 → 5분 → 15분 재시도 간격 |
| 채널별 Worker | ✅ | Email / SMS / Kakao 독립 Kafka Consumer |
| Realtime Chat | ✅ | WebSocket Gateway (joinRoom / sendMessage) + API key 인증 |
| Docker Compose | ✅ | PostgreSQL + Zookeeper + Kafka + Redis + Jaeger |
| 분산 트레이싱 | ✅ | OpenTelemetry → Jaeger (HTTP, Express, Kafka, PostgreSQL 자동 계측) |

---

## Getting Started

### Prerequisites

- Node.js LTS
- Yarn 1.x
- PostgreSQL
- Apache Kafka

### Installation

```bash
yarn install
```

### Environment

```bash
cp .env.example .env
# .env 파일에서 DB / Kafka 연결 정보 설정
```

### Run

```bash
# 인프라 (PostgreSQL + Kafka) 먼저 실행
docker-compose up -d

# api-gateway (포트 3000)
yarn start api-gateway

# admin-api (포트 3000 — 별도 포트 설정 권장)
yarn start admin-api

# worker들
yarn start worker-email
yarn start worker-sms
yarn start worker-kakao

# 재시도 스케줄러 + Outbox Relay
yarn start main

# 실시간 채팅 (포트 3001)
yarn start realtime-chat
```

### Swagger

| 앱 | URL |
|----|-----|
| api-gateway | `http://localhost:3000/docs` |
| admin-api | `http://localhost:3000/docs` |

### 모니터링

| 도구 | URL | 설명 |
|------|-----|------|
| Jaeger UI | `http://localhost:16686` | 분산 트레이싱 시각화 |
| api-gateway Metrics | `http://localhost:3000/metrics` | Prometheus 메트릭 |
| admin-api Metrics | `http://localhost:3000/metrics` | Prometheus 메트릭 |

---

## Testing

```bash
yarn test          # 전체 단위 테스트
yarn test:watch    # watch 모드
yarn test:cov      # 커버리지 포함
```

현재 **104개 단위 테스트** 통과 (Jest + @nestjs/testing, 실제 DB 없이 mock 기반)

주요 테스트 대상:

- `TemplateVariableValidator` — 7가지 데이터 타입 검증 로직
- `ClientAuthService` — 인증 플로우 전체 (IP 화이트리스트 포함)
- `AdminAuthGuard` — ADMIN keyType 전용 접근 제어
- `RateLimitGuard` — 분당 한도 초과 / 클라이언트별 독립 추적
- `ClientPermissionGuard` — 권한 있음/없음/불필요 케이스
- `TemplateService` — PUBLIC / PRIVATE / RESTRICTED 접근 범위
- `MessageRequestService` — 신규 요청 / Outbox 기록 / Kafka 실패 / 멱등 재시도
- `KafkaService` — Producer lifecycle / 토픽·키 검증
- `OutboxRelayService` — PENDING 이벤트 발행 / 실패 처리 / 다중 이벤트
- `RetrySchedulerService` — RETRY_WAIT 재발행 / 데이터 누락 시 FAILED 처리

---

## API Overview

### api-gateway

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/messages/send` | 메시지 발송 요청 (멱등, requestId 기반) |
| `GET` | `/templates/:code` | 템플릿 단건 조회 |
| `GET` | `/templates/:code/variables` | 템플릿 변수 목록 |
| `GET` | `/clients/templates` | 클라이언트가 사용 가능한 템플릿 목록 |

모든 엔드포인트는 `x-api-key` / `x-api-secret` 헤더 인증 필요

### admin-api

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/admin/client-apps/:id/api-keys` | API Key 발급 |

`AdminAuthGuard` 적용 — `ApiKeyType.ADMIN` 키만 접근 가능

---

## Future Improvements

- [x] TypeORM Migration 인프라 — `libs/database/src/data-source.ts` + `migration:generate/run/revert` 스크립트
- [x] Redis 기반 Rate Limiting — `ioredis` sorted set sliding window, 멀티 인스턴스 지원
- [x] WebSocket 인증 — handshake `x-api-key` / `x-api-secret` 검증 (`WsAuthService`)
- [x] Chat 읽음 처리 API — `POST /chat/rooms/:roomId/read` → `tb_chat_message_read` upsert
- [x] Request tracing in Logger — `nestjs-cls` AsyncLocalStorage, 모든 로그에 `[req:xxx]` 자동 삽입
- [x] Prometheus 메트릭 — HTTP 요청수/응답시간 인터셉터, `/metrics` 엔드포인트 (api-gateway, admin-api)
- [x] 분산 트레이싱 — OpenTelemetry SDK + OTLP HTTP → Jaeger, 전 앱 auto-instrumentation (`OTEL_ENABLED=false` 로 비활성화 가능)
