# Dead Letter Queue (DLQ) Design

**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** 최대 재시도 초과 시 DLQ Kafka 토픽 전송 + DB 저장 + 관리자 조회

---

## Background

현재 `BaseWorkerService`는 `retryCount >= maxRetryCount`일 때 `MessageDispatch`를 `FAILED`로 마킹하고 종료한다. 메시지는 그대로 소실되어 왜 실패했는지 추적이 불가능하고 수동 재처리 방법도 없다.

DLQ 패턴을 도입해 실패 이벤트를 별도 Kafka 토픽으로 라우팅하고 DB에 저장, 관리자가 원인을 분석하고 재처리 결정을 내릴 수 있도록 한다.

---

## Decisions

| 항목 | 결정 |
|------|------|
| DLQ 발행 시점 | `BaseWorkerService`에서 `!canRetry` 분기 진입 시 |
| DLQ 토픽 | `message.dlq` (env `KAFKA_TOPIC_MESSAGE_DLQ`, 기본값 `message.dlq`) |
| KafkaService 주입 | `BaseWorkerService`에 `@Optional() KafkaService` — 워커 모듈이 `KafkaModule` import 시 활성화 |
| DLQ 소비자 | `main` 앱의 `DlqConsumerService` — `message.dlq` 구독 → DB 저장 |
| DB 테이블 | `tb_message_dlq` (`MessageDlqEntity`) |
| 관리자 조회 | `admin-api` — `GET /admin/dlq` (페이지네이션) |
| 재암호화 여부 | 없음 — DLQ 이벤트는 워커가 이미 복호화한 평문 variables 사용 |

---

## Architecture

```
BaseWorkerService (worker-email/sms/kakao)
  │
  ├─ 처리 성공 → SUCCESS
  ├─ 처리 실패, canRetry → RETRY_WAIT
  └─ 처리 실패, !canRetry
       ├─ dispatch.status = FAILED
       └─ KafkaService.publishDlq(MessageDlqEvent)
                              │
                    Kafka topic: message.dlq
                              │
                    DlqConsumerService (main)
                              │
                    MessageDlqEntity → tb_message_dlq
                              │
                    GET /admin/dlq (admin-api)
```

---

## Event Contract

### `MessageDlqEvent`

```typescript
// libs/contracts/src/events/message-dlq.event.ts
export interface MessageDlqEvent extends MessageSendEvent {
  dispatchId: string;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  failedAt: string; // ISO 8601
}
```

`MessageSendEvent`를 확장 — 기존 필드(`messageRequestId`, `requestId`, `recipientId`, `channel`, `variables` 등) 전부 포함.

---

## Database

### `MessageDlqEntity` (`tb_message_dlq`)

```
id                 uuid PK
message_request_id uuid
dispatch_id        uuid
recipient_id       uuid
channel_type       enum(ChannelType)
error_code         varchar(100)
error_message      text
retry_count        integer
original_event     jsonb   -- 전체 MessageDlqEvent 보존
failed_at          timestamptz
created_at         timestamptz
```

인덱스:
- `(channel_type, failed_at)` — 채널별 실패 현황 조회
- `(message_request_id)` — 특정 요청의 DLQ 이력 조회

---

## Component Changes

### 1. `KafkaService` (libs/kafka)

`publishDlq(event: MessageDlqEvent)` 메서드 추가:
```typescript
async publishDlq(event: MessageDlqEvent): Promise<void> {
  const topic = this.configService.get<string>('KAFKA_TOPIC_MESSAGE_DLQ', 'message.dlq');
  await this.publish(topic, event.requestId, event);
}
```

### 2. `BaseWorkerService` (libs/kafka)

- 생성자에 `@Optional() private readonly kafkaService?: KafkaService` 추가
- `!canRetry` 분기에 DLQ 발행 추가:
```typescript
// 기존: dispatch.status = FAILED, done
// 추가:
if (this.kafkaService) {
  await this.kafkaService.publishDlq({
    ...event,
    dispatchId: savedDispatch.id,
    errorCode: this.errorCode,
    errorMessage,
    retryCount: savedDispatch.retryCount,
    failedAt: new Date().toISOString(),
  });
}
```

### 3. 워커 모듈 3개

`KafkaModule` import 추가 → `KafkaService` DI 활성화.

### 4. `DlqConsumerService` (apps/main)

`OnModuleInit`: kafkajs consumer로 `message.dlq` 구독.
이벤트 수신 시 `MessageDlqEntity` 저장.

```typescript
@Injectable()
export class DlqConsumerService implements OnModuleInit, OnModuleDestroy {
  // subscribe to message.dlq, save MessageDlqEntity on each message
}
```

### 5. `MainModule` (apps/main)

- `MessageDlqEntity` TypeORM 등록
- `DlqConsumerService` providers 추가

### 6. DLQ 조회 (apps/admin-api)

`GET /admin/dlq?page=1&limit=20`

- `AdminAuthGuard` 적용 (기존 패턴)
- `DlqModule` — controller + service, `MessageDlqEntity` TypeORM 접근
- `AdminApiModule` TypeORM config에 `MessageDlqEntity` 추가

---

## Environment Variables

```bash
# DLQ Kafka 토픽 이름 (기본값: message.dlq)
KAFKA_TOPIC_MESSAGE_DLQ=message.dlq

# DLQ consumer group
KAFKA_DLQ_CONSUMER_GROUP_ID=dlq-consumer-group
KAFKA_DLQ_CLIENT_ID=main-dlq-consumer
```

`.env.example`에 추가.

---

## Testing Strategy (TDD)

### 신규 테스트

**`libs/kafka/test/kafka.service.spec.ts` 업데이트**
- `publishDlq` — `message.dlq` 토픽으로 발행되는지 확인
- `publishDlq` — `requestId`를 파티션 키로 사용하는지 확인

**`apps/main/test/modules/dlq/dlq-consumer.service.spec.ts` 신규**
- DLQ 이벤트 수신 시 `MessageDlqEntity` 저장 확인
- 파싱 실패(잘못된 JSON) 시 crash 없이 로그만 남기는지 확인

**`apps/admin-api/test/modules/dlq/dlq.controller.spec.ts` 신규**
- `GET /admin/dlq` — DLQ 목록 반환 확인
- 페이지네이션 파라미터 적용 확인

### 기존 테스트 업데이트

**`libs/kafka/test/kafka.service.spec.ts`**
- `publishMessageSend` 기존 테스트 유지
- `publishDlq` 테스트 추가

---

## Error Handling

- DLQ 발행 자체가 실패해도 원래 `FAILED` 처리는 이미 완료된 상태. DLQ 발행 실패는 best-effort — 에러를 로그로만 남기고 re-throw하지 않음.
- `DlqConsumerService`에서 메시지 파싱 실패 시 에러 로그 후 continue — consumer가 멈추지 않도록.

---

## Out of Scope

- DLQ 수동 재처리 API (재발행 엔드포인트)
- DLQ 이벤트 TTL / 자동 삭제
- DLQ 알림 (Slack, 이메일 등)
- DLQ 이벤트 재암호화
