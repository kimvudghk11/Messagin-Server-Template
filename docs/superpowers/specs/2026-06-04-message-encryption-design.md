# Message Payload Encryption Design

**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** Field-level AES-256-GCM encryption for message payload variables

---

## Background

`MessagePayloadEntity`의 `payloadJson` 컬럼에 템플릿 변수(이름, 이메일, 전화번호 등 PII)가 평문으로 저장되고 있음. Kafka 이벤트 `variables` 필드도 평문으로 브로커를 통과함.

`maskedPayloadJson`, `encryptionStatus` 컬럼이 이미 스키마에 존재하지만 사용되지 않은 상태. 이번 구현으로 두 컬럼을 실제로 활용.

---

## Decisions

| 항목 | 결정 |
|------|------|
| 암호화 알고리즘 | AES-256-GCM |
| 키 관리 | 환경변수 `PAYLOAD_ENCRYPTION_KEY` (32바이트 base64) |
| 저장 방식 | JSON 엔벨로프 — 컬럼 타입 변경·추가 없음 |
| Kafka 범위 | 암호화된 엔벨로프를 `variables` 필드로 발행 |
| 감사 로그 | `maskedPayloadJson`에 마스킹된 평문 저장 |

---

## Architecture

### 새 파일

```
libs/common/src/crypto/
  payload-crypto.service.ts   # 암호화·복호화·마스킹 로직
  payload-crypto.module.ts    # NestJS 모듈

libs/common/test/crypto/
  payload-crypto.service.spec.ts
```

### `PayloadCryptoService` API

```typescript
class PayloadCryptoService {
  encrypt(data: Record<string, unknown>): Record<string, unknown>
  // 반환: { _enc: string, _iv: string, _tag: string }

  decrypt(envelope: Record<string, unknown>): Record<string, unknown>
  // _enc 키 존재 확인 후 복호화

  mask(data: Record<string, unknown>): Record<string, unknown>
  // 키 이름 패턴 기반 PII 마스킹
}
```

키는 `ConfigService`에서 `PAYLOAD_ENCRYPTION_KEY` 읽음. 모듈 초기화 시 키 유효성 검증(32바이트).

### JSON 엔벨로프 형식

```json
{
  "_enc": "base64-encoded-ciphertext",
  "_iv":  "base64-encoded-iv-12-bytes",
  "_tag": "base64-encoded-auth-tag-16-bytes"
}
```

`encryptionStatus = ENCRYPTED`인 경우 `payloadJson`은 항상 이 형식.

---

## Masking Rules

키 이름을 소문자 변환 후 패턴 매칭:

| 패턴 | 예시 원본 | 마스킹 결과 |
|------|----------|------------|
| `*email*` | `user@example.com` | `us***@example.com` |
| `*phone*` | `010-1234-5678` | `010-****-5678` |
| `*name*` | `Alice` | `Al***` |
| 그 외 문자열 | `hello` | `hel***` |
| 숫자/불리언 | `42`, `true` | 변경 없음 |
| 중첩 객체 | `{ a: { b: "x" } }` | 재귀 마스킹 |

---

## Data Flow

### 메시지 요청 처리 (api-gateway)

```
MessageRequestService.sendMessage(dto)
  │
  ├─ PayloadCryptoService.mask(dto.variables)
  │    → maskedPayloadJson 저장 (감사용)
  │
  ├─ PayloadCryptoService.encrypt(dto.variables)
  │    → payloadJson 저장 (엔벨로프)
  │    → encryptionStatus = ENCRYPTED
  │
  └─ KafkaService.publishMessageSend({
         variables: 암호화된 엔벨로프,
         ...
     })
```

### 재시도 스케줄러 (main)

```
RetrySchedulerService.retryPendingDispatches()
  │
  ├─ DB에서 payload.payloadJson 로드 (엔벨로프)
  ├─ PayloadCryptoService.decrypt(payloadJson)
  │    → 평문 variables 복원
  └─ KafkaService.publishMessageSend({ variables: 평문, ... })
```

재시도 시 Kafka로는 평문을 발행 → 워커가 암호화 여부를 판단할 필요 없음.

> **대안 고려:** 재시도도 암호화 상태로 발행하면 워커 일관성은 올라가지만 복잡도 증가. 재시도는 내부 흐름이므로 평문 발행으로 단순화.

### 워커 수신 (worker-email, worker-sms, worker-kakao)

```
BaseWorkerService → handleMessage(event)
  │
  ├─ event.variables에 _enc 키가 있으면?
  │    → PayloadCryptoService.decrypt(event.variables)
  └─ 기존 발송 로직 그대로
```

---

## Environment Variables

```bash
# 32바이트 랜덤 키를 base64로 인코딩
# 생성 명령: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
PAYLOAD_ENCRYPTION_KEY=your-32-byte-base64-encoded-key
```

키 누락 시 `PayloadCryptoService` 초기화에서 `Error` throw.

---

## Module Integration

`PayloadCryptoModule`을 각 앱 모듈에서 import:
- `ApiGatewayModule`
- `MainModule` (retry-scheduler용)
- `WorkerEmailModule`, `WorkerSmsModule`, `WorkerKakaoModule`

`libs/common/src/index.ts`에 export 추가.

---

## Testing Strategy (TDD)

모든 구현은 실패하는 테스트 먼저 작성:

### `payload-crypto.service.spec.ts`
- `encrypt` → `decrypt` 라운드트립 검증
- 동일 입력에 대해 IV가 매번 달라야 함 (랜덤 IV)
- 잘못된 키로 복호화 시 `Error` throw
- `mask` — 각 패턴별 마스킹 결과 검증
- 중첩 객체 재귀 마스킹 검증
- 키 누락 시 초기화 실패 검증

### `message-request.service.spec.ts` 업데이트
- `encryptionStatus: ENCRYPTED`로 저장되는지 확인
- `payloadJson`에 `_enc` 키 존재 확인
- `maskedPayloadJson`이 null이 아닌지 확인

### `retry-scheduler.service.spec.ts` 업데이트
- 암호화된 payload를 복호화 후 Kafka 발행하는지 확인

### 워커 spec 업데이트
- `_enc` 키가 있는 event → 복호화 후 처리
- 평문 event → 그대로 처리 (하위 호환)

---

## Out of Scope

- 키 로테이션 (기존 암호화 데이터 재암호화)
- 기존 PLAIN 데이터의 소급 암호화
- KMS/Vault 연동
- 필드별 선택적 암호화 (전체 variables 객체 단위로 암호화)
