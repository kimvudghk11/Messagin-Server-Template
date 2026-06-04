# README 업데이트 + 테스트 통합 설계

## 목표

1. README를 프로젝트 배경/동기부터 전면 재작성하여 완성도 높이기
2. 전 앱/라이브러리에 흩어진 spec 파일을 앱별 `test/` 폴더로 통합 (소스 구조 미러링)

---

## 1. 테스트 통합 설계

### 전략

각 앱/라이브러리 내부에 `src/` 옆에 `test/` 폴더를 생성하고, 소스 디렉터리 구조를 그대로 미러링하여 spec 파일을 이동한다.

```
apps/<app>/
  src/
    modules/auth/foo.service.ts
  test/
    modules/auth/foo.service.spec.ts   ← src 구조 미러
```

`jest.config.js`의 `testRegex: '.*\\.spec\\.ts$'`는 `test/` 디렉터리도 자동 탐색하므로 변경 불필요.

### 삭제할 스텁 파일 (6개)

NestJS CLI가 자동 생성한 의미 없는 파일. 삭제로 커버리지 왜곡 제거.

| 파일 | 이유 |
|------|------|
| `apps/api-gateway/src/api-gateway.controller.spec.ts` | "Hello World!" 스텁 |
| `apps/admin-api/src/admin-api.controller.spec.ts` | "Hello World!" 스텁 |
| `libs/common/src/common.service.spec.ts` | "should be defined" 스텁 |
| `libs/contracts/src/contracts.service.spec.ts` | "should be defined" 스텁 |
| `libs/database/src/database.service.spec.ts` | "should be defined" 스텁 |
| `libs/auth/src/auth.service.spec.ts` | "should be defined" 스텁 |

### 이동할 실질 테스트 파일 (15개)

| 현재 경로 | 이동 후 경로 |
|-----------|------------|
| `apps/api-gateway/src/guards/rate-limit.guard.spec.ts` | `apps/api-gateway/test/guards/rate-limit.guard.spec.ts` |
| `apps/api-gateway/src/guards/client-permission.guard.spec.ts` | `apps/api-gateway/test/guards/client-permission.guard.spec.ts` |
| `apps/api-gateway/src/modules/auth/client-auth.service.spec.ts` | `apps/api-gateway/test/modules/auth/client-auth.service.spec.ts` |
| `apps/api-gateway/src/modules/template/template.service.spec.ts` | `apps/api-gateway/test/modules/template/template.service.spec.ts` |
| `apps/api-gateway/src/modules/message-request/message-request.service.spec.ts` | `apps/api-gateway/test/modules/message-request/message-request.service.spec.ts` |
| `apps/api-gateway/src/modules/message-request/validator/template-variable.validator.spec.ts` | `apps/api-gateway/test/modules/message-request/validator/template-variable.validator.spec.ts` |
| `apps/admin-api/src/guards/admin-auth.guard.spec.ts` | `apps/admin-api/test/guards/admin-auth.guard.spec.ts` |
| `apps/worker-email/src/worker-email.controller.spec.ts` | `apps/worker-email/test/worker-email.controller.spec.ts` |
| `apps/worker-sms/src/worker-sms.controller.spec.ts` | `apps/worker-sms/test/worker-sms.controller.spec.ts` |
| `apps/worker-kakao/src/worker-kakao.controller.spec.ts` | `apps/worker-kakao/test/worker-kakao.controller.spec.ts` |
| `apps/main/src/modules/outbox-relay/outbox-relay.service.spec.ts` | `apps/main/test/modules/outbox-relay/outbox-relay.service.spec.ts` |
| `apps/main/src/modules/retry-scheduler/retry-scheduler.service.spec.ts` | `apps/main/test/modules/retry-scheduler/retry-scheduler.service.spec.ts` |
| `apps/realtime-chat/src/realtime-chat.controller.spec.ts` | `apps/realtime-chat/test/realtime-chat.controller.spec.ts` |
| `libs/kafka/src/kafka.service.spec.ts` | `libs/kafka/test/kafka.service.spec.ts` |
| `libs/common/src/tracing/tracing.spec.ts` | `libs/common/test/tracing/tracing.spec.ts` |

### Import 경로 업데이트 규칙

파일이 `src/` → `test/`로 이동하면 상대 경로가 변경된다.

- `test/guards/foo.spec.ts`에서 소스 참조: `../../src/guards/foo`
- `test/modules/auth/foo.spec.ts`에서 소스 참조: `../../../src/modules/auth/foo`
- `test/modules/message-request/validator/foo.spec.ts`에서 소스 참조: `../../../../src/modules/message-request/validator/foo`
- `libs/kafka/test/foo.spec.ts`에서 소스 참조: `../src/foo`
- `libs/common/test/tracing/foo.spec.ts`에서 소스 참조: `../../src/tracing/foo`

`@app/xxx` alias import는 jest.config.js의 `moduleNameMapper`가 처리하므로 변경 불필요.

### jest.config.js 변경사항

없음. 기존 `testRegex: '.*\\.spec\\.ts$'`가 `test/` 디렉터리를 자동 포함.

---

## 2. README 재구성 설계

### 새 구조

```
1. 헤더 (프로젝트명 + 한줄 설명)
2. Why This Project          ← 신규: 회사 배경 + Kafka 학습 동기
3. Architecture              ← 기존 유지, 깨진 박스 수정
4. Tech Stack                ← 기존 유지
5. Monorepo Structure        ← main/realtime-chat 설명 개선
6. Key Design Decisions      ← Outbox "구현 예정" → "구현 완료" 수정
7. Database Schema           ← 기존 유지
8. What's Implemented        ← 최신화
9. Getting Started           ← Docker Compose 상세화, 포트 명확화
10. Testing                  ← 새 test/ 구조 반영
11. API Overview             ← 기존 유지
12. Monitoring               ← 기존 유지
13. Future Improvements      ← 잔여 항목 정리
```

### Why This Project 섹션 내용

회사에서 메시징 서비스를 기존 백엔드 레포 중 하나에 급히 추가했다가 과부하 문제가 발생한 경험에서 출발. 메시징 서버는 별도의 서비스로 분리되어야 하고, Kafka 기반 비동기 처리로 채널별 워커를 독립 스케일아웃하는 구조가 필요하다는 것을 체득. 이를 템플릿으로 정리한 프로젝트.

### 주요 수정 사항

| 항목 | 현재 | 수정 후 |
|------|------|---------|
| Outbox 설명 | "설계 완료, 구현 예정" | 구현 완료로 수정 |
| admin-api 포트 | "포트 3000 — 별도 포트 설정 권장" | `PORT=3001 yarn start admin-api` 명시 (api-gateway와 충돌 방지) |
| 테스트 섹션 | 소스 co-location 기준 | 새 test/ 구조 기준 |
| main 앱 설명 | "공통 부트스트랩 실험용" | RetryScheduler + OutboxRelay 역할 명시 |

---

## 성공 기준

- `yarn test` 실행 시 동일한 테스트가 모두 통과 (테스트 수 유지 또는 스텁 제거로 소폭 감소)
- 모든 spec 파일이 `test/` 폴더에 위치
- `src/` 폴더에 `.spec.ts` 파일 없음
- README가 프로젝트 배경부터 완전한 문서로 완성
