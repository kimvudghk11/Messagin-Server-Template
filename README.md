# Messaging Server Template

NestJS 모노레포 기반 메시징 플랫폼 템플릿입니다.

이 프로젝트는 단순 CRUD 서버가 아니라, 외부 시스템의 발송 요청을 안정적으로 수집하고, 채널별 워커가 비동기로 처리하며, 추적 가능한 로그/상태를 제공하는 플랫폼 구조를 목표로 합니다.

## 1. 프로젝트 목표

- API Gateway를 통해 메시지 발송 요청을 일관된 규격으로 수신
- 요청, 수신자, 발송 단위, 발송 로그를 분리 저장해 추적성 확보
- Kafka Outbox 패턴 기반으로 이벤트 발행 안정성 확보
- Email/SMS/Kakao 워커를 분리해 채널별 확장성 확보
- Admin API로 운영/감사 관점 기능 확장 가능하도록 설계
- 실시간 채팅 도메인을 메시징 도메인과 분리해 독립 확장 가능하도록 구성

## 2. 기술 스택

- Runtime: Node.js
- Language: TypeScript (strict 모드)
- Framework: NestJS
- Database: PostgreSQL + TypeORM
- Messaging: Kafka (라이브러리/도메인 기반 확장 구조)
- Validation: class-validator, class-transformer
- Tooling: ESLint Flat Config, Prettier, Yarn

## 3. 모노레포 구조

핵심 원칙은 아래와 같습니다.

- apps는 비즈니스 오케스트레이션과 엔드포인트에 집중
- libs는 공통 관심사, 계약, 데이터 접근 계층을 담당
- Entity는 database lib에만 위치
- API/Kafka 계약 모델은 contracts lib로 분리

```text
apps/
	admin-api/
	api-gateway/
	main/
	realtime-chat/
	worker-email/
	worker-kakao/
	worker-sms/

libs/
	auth/
	common/
	contracts/
	database/
		src/
			entities/
				base/
				client-auth/
				template/
				message/
				outbox-event/
				admin-audit/
				chat/
			enums/
	kafka/
```

## 4. 앱별 역할

### api-gateway

- 외부 서비스의 요청 진입점
- 인증(API Key), 권한, 요청 포맷 검증
- 메시지 요청 생성 및 상태 관리 시작점

### worker-email / worker-sms / worker-kakao

- 채널별 발송 처리 전담
- 재시도, 실패/성공 상태 업데이트
- provider 연동 및 발송 로그 기록

### admin-api

- 템플릿, 클라이언트, 발송 내역 운영/관리 기능 제공
- 감사 로그와 운영 관제 관점 확장

### realtime-chat

- 채팅방, 참여자, 채팅 메시지 등 실시간 커뮤니케이션 도메인 담당
- 메시징 발송 도메인과 독립된 수명주기 관리

### main

- 공통 초기화/부트스트랩 실험 또는 통합 진입점 역할

## 5. 라이브러리별 역할

### libs/database

- TypeORM Entity, DB Enum, 공통 베이스 엔티티 제공
- 도메인별 디렉터리 분리로 유지보수성과 가독성 강화

#### Entity 분류

- client-auth: 클라이언트 앱, API Key, 권한, 채널 정책
- template: 템플릿/변수/채널 상세
- message: 요청, payload, 수신자, 발송, 발송 로그
- outbox-event: 이벤트 발행용 outbox
- admin-audit: 관리자 액션 감사 로그
- chat: 채팅방, 참여자, 메시지, 읽음, 첨부

#### Base Entity 전략

- BaseCreatedAtEntity: created_at 공통
- BaseTimeEntity: created_at + updated_at 공통

중복 컬럼 선언을 줄이고, 일관된 timestamp 정책을 유지합니다.

### libs/contracts

- DTO, Event, 외부 계약 모델의 중심
- DB 모델과 분리해 API/Kafka 계약 안정성 확보

### libs/common

- 공통 유틸, 예외 처리, 공통 모듈 등 범용 구성 요소

### libs/auth

- 인증/인가 관련 공통 로직 확장 지점

### libs/kafka

- Kafka producer/consumer 공통 추상화 및 인프라 접점

## 6. 도메인 경계 원칙

### Entity vs DTO vs Event

- Entity: DB 저장 모델 (database)
- DTO: API 요청/응답 계약 (contracts)
- Event: Kafka 메시지 계약 (contracts)

DB 스키마와 외부 계약 모델을 분리해 변경 충격을 줄이는 것이 핵심입니다.

### Enum 분리 원칙

- DB Enum: libs/database/src/enums
- 계약 Enum: libs/contracts/src (추가/확장 예정)

이 분리를 통해 DB 마이그레이션과 API 계약 변경을 독립적으로 관리할 수 있습니다.

## 7. 현재 DB 모델 상태

PostgreSQL 스키마 기준으로 아래 영역이 반영되어 있습니다.

- Client/Auth Domain
- Template Domain
- Message Request/Dispatch Domain
- Outbox/Event Domain
- Admin/Audit Domain
- Chat Domain

또한 대부분의 엔티티는 BaseTimeEntity 또는 BaseCreatedAtEntity를 상속하여 timestamp 정책이 통일되어 있습니다.

## 8. 개발 시작 가이드

### 사전 요구사항

- Node.js LTS
- Yarn 1.x 이상
- PostgreSQL

### 설치

```bash
yarn install
```

### 주요 스크립트

```bash
yarn start
yarn start:dev
yarn build
yarn lint
yarn lint:fix
yarn type-check
yarn check
```

## 9. 권장 개발 순서

플랫폼 안정성을 위해 아래 순서를 권장합니다.

1. api-gateway: message-request 모듈 우선
2. template 조회/검증 기능
3. client-app 인증/권한
4. outbox 기반 Kafka publish
5. worker-email/sms/kakao 처리 파이프라인
6. admin-api 운영 기능
7. realtime-chat 기능 확장

핵심은 발송 자체보다 요청(request) 저장과 상태 추적의 안정화를 먼저 완성하는 것입니다.

## 10. 개발 원칙 요약

- apps에는 Entity를 두지 않는다
- DB 모델과 API 계약 모델을 혼용하지 않는다
- enum을 목적(DB/계약)에 맞게 분리한다
- 공통 컬럼은 Base Entity로 통일한다
- 비즈니스 로직은 서비스 계층에 집중한다

## 11. 다음 확장 포인트

- TypeORM relation 상세 매핑 강화
- Migration 전략 표준화
- Repository 계층 명시적 분리
- Outbox publisher 및 worker retry 정책 고도화
- 관제용 메트릭/트레이싱 도입

---

필요하면 다음 단계로 아래 문서도 이어서 정리할 수 있습니다.

- API Gateway 메시지 요청 처리 플로우 상세
- Worker 재시도/실패 복구 정책
- contracts 표준(DTO/Event/Enum) 가이드
