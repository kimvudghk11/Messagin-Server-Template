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
│  · API Key 인증 (timingSafeEqual + IP 화이트리스트)        │
│  · 템플릿 변수 검증                                        │
│  · MessageRequest / Payload / Recipient DB 저장           │
│  · Kafka topic: message.send 발행                         │
└─────────────────────┬───────────────────────────────────┘
                      │ Kafka
          ┌───────────┼───────────┐
          ▼           ▼           ▼
   worker-email  worker-sms  worker-kakao
   (EMAIL 필터)  (SMS 필터)  (KAKAO 필터)
          │           │           │
          └───────────┴───────────┘
                      │ MessageDispatch / Log DB 저장
                      ▼
              MessageRequest.status = COMPLETED

┌─────────────────────────────────────────────────────────┐
│                     admin-api                            │
│  · AdminAuthGuard (ADMIN keyType 전용)                   │
│  · 클라이언트 앱 / API Key 발급 관리                       │
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
# api-gateway
yarn start api-gateway

# worker-email
yarn start worker-email

# worker-sms
yarn start worker-sms

# worker-kakao
yarn start worker-kakao

# admin-api
yarn start admin-api
```

### Swagger

| 앱 | URL |
|----|-----|
| api-gateway | `http://localhost:3000/docs` |
| admin-api | `http://localhost:3000/docs` |

---

## Testing

```bash
yarn test          # 전체 단위 테스트
yarn test:watch    # watch 모드
yarn test:cov      # 커버리지 포함
```

현재 **81개 단위 테스트** 통과 (Jest + @nestjs/testing, 실제 DB 없이 mock 기반)

주요 테스트 대상:

- `TemplateVariableValidator` — 7가지 데이터 타입 검증 로직
- `ClientAuthService` — 인증 플로우 전체 (IP 화이트리스트 포함)
- `AdminAuthGuard` — ADMIN keyType 전용 접근 제어
- `TemplateService` — PUBLIC / PRIVATE / RESTRICTED 접근 범위
- `MessageRequestService` — 신규 요청 / Kafka 실패 / 멱등 재시도 (상태별 전체 케이스)
- `KafkaService` — Producer lifecycle / 토픽·키 검증

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

## Roadmap

- [ ] Outbox Relay 프로세스 구현 (DB → Kafka at-least-once 보장)
- [ ] 재시도 스케줄러 (`next_retry_at` 기반 지수 백오프)
- [ ] `ClientPermission` 권한 체크 미들웨어 연동
- [ ] Rate limiting 적용 (`rate_limit_per_minute` 필드 활용)
- [ ] Request tracing (`x-request-id` 헤더 전파)
- [ ] Docker Compose (PostgreSQL + Kafka 포함)
- [ ] realtime-chat WebSocket 구현
