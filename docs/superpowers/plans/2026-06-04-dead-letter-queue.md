# Dead Letter Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 최대 재시도 초과 시 실패한 메시지를 `message.dlq` Kafka 토픽으로 전송하고 DB에 저장해 관리자가 조회할 수 있도록 한다.

**Architecture:** `BaseWorkerService`가 `!canRetry` 분기에서 `KafkaService.publishDlq()`를 호출 → `DlqConsumerService`(main 앱)가 `message.dlq` 토픽을 구독해 `MessageDlqEntity`로 DB 저장 → `admin-api`의 `GET /admin/dlq`로 조회.

**Tech Stack:** kafkajs, TypeORM (PostgreSQL jsonb), NestJS DI `@Optional()`, class-validator

---

## File Map

| Action | Path | 역할 |
|--------|------|------|
| Create | `libs/contracts/src/events/message-dlq.event.ts` | DLQ 이벤트 계약 타입 |
| Modify | `libs/contracts/src/index.ts` | MessageDlqEvent export 추가 |
| Create | `libs/database/src/entities/message/message-dlq.entity.ts` | DLQ DB 엔티티 |
| Modify | `libs/database/src/entities/message/index.ts` | MessageDlqEntity export 추가 |
| Modify | `libs/kafka/src/kafka.service.ts` | publishDlq() 메서드 추가 |
| Modify | `libs/kafka/test/kafka.service.spec.ts` | publishDlq 테스트 추가 |
| Modify | `libs/kafka/src/worker/base-worker.service.ts` | !canRetry 시 DLQ 발행 |
| Modify | `apps/worker-email/src/worker-email.module.ts` | KafkaModule import 추가 |
| Modify | `apps/worker-sms/src/worker-sms.module.ts` | KafkaModule import 추가 |
| Modify | `apps/worker-kakao/src/worker-kakao.module.ts` | KafkaModule import 추가 |
| Create | `apps/main/src/modules/dlq/dlq-consumer.service.ts` | DLQ Kafka 소비자 + DB 저장 |
| Create | `apps/main/test/modules/dlq/dlq-consumer.service.spec.ts` | DlqConsumerService 테스트 |
| Modify | `apps/main/src/main.module.ts` | DlqConsumerService + MessageDlqEntity 등록 |
| Create | `apps/admin-api/src/modules/dlq/dlq.service.ts` | DLQ 목록 조회 서비스 |
| Create | `apps/admin-api/src/modules/dlq/dlq.controller.ts` | GET /admin/dlq 컨트롤러 |
| Create | `apps/admin-api/src/modules/dlq/dlq.module.ts` | DLQ NestJS 모듈 |
| Create | `apps/admin-api/test/modules/dlq/dlq.controller.spec.ts` | DlqController 테스트 |
| Modify | `apps/admin-api/src/admin-api.module.ts` | DlqModule + MessageDlqEntity 등록 |
| Modify | `.env.example` | DLQ 환경변수 항목 추가 |
| Modify | `.env` | DLQ 환경변수 기본값 추가 |

---

## Task 1: MessageDlqEvent 계약 타입

**Files:**
- Create: `libs/contracts/src/events/message-dlq.event.ts`
- Modify: `libs/contracts/src/index.ts`

- [ ] **Step 1: MessageDlqEvent 파일 생성**

`libs/contracts/src/events/message-dlq.event.ts`:

```typescript
import { MessageSendEvent } from './message-send.event';

export interface MessageDlqEvent extends MessageSendEvent {
  dispatchId: string;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  failedAt: string; // ISO 8601
}
```

- [ ] **Step 2: index.ts에 export 추가**

`libs/contracts/src/index.ts` 마지막 줄에 추가:

```typescript
export * from './contracts.module';
export * from './contracts.service';
export * from './events/message-send.event';
export * from './events/message-dlq.event';
```

- [ ] **Step 3: 커밋**

```bash
git add libs/contracts/src/events/message-dlq.event.ts libs/contracts/src/index.ts
git commit -m "feat: MessageDlqEvent 계약 타입 추가"
```

---

## Task 2: MessageDlqEntity DB 엔티티

**Files:**
- Create: `libs/database/src/entities/message/message-dlq.entity.ts`
- Modify: `libs/database/src/entities/message/index.ts`

- [ ] **Step 1: MessageDlqEntity 파일 생성**

`libs/database/src/entities/message/message-dlq.entity.ts`:

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ChannelType } from '../../enums/client-auth.enums';
import { BaseCreatedAtEntity } from '../base';

@Entity('tb_message_dlq')
@Index('idx_tb_message_dlq_channel_failed_at', ['channelType', 'failedAt'])
@Index('idx_tb_message_dlq_message_request_id', ['messageRequestId'])
export class MessageDlqEntity extends BaseCreatedAtEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_request_id', type: 'uuid' })
  messageRequestId!: string;

  @Column({ name: 'dispatch_id', type: 'uuid' })
  dispatchId!: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string;

  @Column({
    name: 'channel_type',
    type: 'enum',
    enum: ChannelType,
    enumName: 'channel_type',
  })
  channelType!: ChannelType;

  @Column({ name: 'error_code', type: 'varchar', length: 100 })
  errorCode!: string;

  @Column({ name: 'error_message', type: 'text' })
  errorMessage!: string;

  @Column({ name: 'retry_count', type: 'integer' })
  retryCount!: number;

  @Column({ name: 'original_event', type: 'jsonb' })
  originalEvent!: Record<string, unknown>;

  @Column({ name: 'failed_at', type: 'timestamptz' })
  failedAt!: Date;
}
```

- [ ] **Step 2: message index.ts 업데이트**

`libs/database/src/entities/message/index.ts`:

```typescript
export * from './message-request.entity';
export * from './message-payload.entity';
export * from './message-recipient.entity';
export * from './message-dispatch.entity';
export * from './message-dispatch-log.entity';
export * from './message-dlq.entity';
```

- [ ] **Step 3: 커밋**

```bash
git add libs/database/src/entities/message/message-dlq.entity.ts libs/database/src/entities/message/index.ts
git commit -m "feat: MessageDlqEntity (tb_message_dlq) 추가"
```

---

## Task 3: KafkaService.publishDlq() (TDD)

**Files:**
- Modify: `libs/kafka/test/kafka.service.spec.ts`
- Modify: `libs/kafka/src/kafka.service.ts`

- [ ] **Step 1: 테스트에 publishDlq 케이스 추가**

`libs/kafka/test/kafka.service.spec.ts`의 configService map에 `KAFKA_TOPIC_MESSAGE_DLQ` 추가하고 `describe('publishDlq')` 블록 추가:

```typescript
// configService의 map 객체에 추가:
KAFKA_TOPIC_MESSAGE_DLQ: 'message.dlq',
```

파일 끝에 새 describe 블록 추가:

```typescript
import { MessageDlqEvent } from '@app/contracts';

// ... (기존 describe 블록들 아래에 추가)

  describe('publishDlq', () => {
    function makeDlqEvent(): MessageDlqEvent {
      return {
        messageRequestId: 'req-uuid',
        requestId: 'req-001',
        recipientId: 'rec-uuid',
        clientAppId: 'app-uuid',
        templateCode: 'WELCOME',
        channel: 'EMAIL',
        receiver: {},
        variables: {},
        priority: 'NORMAL',
        callbackUrl: null,
        requestedAt: new Date().toISOString(),
        dispatchId: 'dispatch-uuid',
        errorCode: 'EMAIL_SEND_FAILED',
        errorMessage: 'SMTP connection refused',
        retryCount: 3,
        failedAt: new Date().toISOString(),
      };
    }

    it('sends to KAFKA_TOPIC_MESSAGE_DLQ topic', async () => {
      await service.onModuleInit();
      mockProducer.send.mockResolvedValue([]);

      await service.publishDlq(makeDlqEvent());

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'message.dlq' }),
      );
    });

    it('uses requestId as the partition key', async () => {
      await service.onModuleInit();
      mockProducer.send.mockResolvedValue([]);

      await service.publishDlq(makeDlqEvent());

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ key: 'req-001' }),
          ]),
        }),
      );
    });
  });
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
yarn test libs/kafka/test/kafka.service.spec.ts --no-coverage
```

예상: `service.publishDlq is not a function`

- [ ] **Step 3: publishDlq 구현**

`libs/kafka/src/kafka.service.ts`에 import 추가:

```typescript
import { MessageSendEvent } from '@app/contracts';
import { MessageDlqEvent } from '@app/contracts';
```

(또는 한 줄로):

```typescript
import { MessageDlqEvent, MessageSendEvent } from '@app/contracts';
```

`publishMessageSend` 아래에 추가:

```typescript
async publishDlq(event: MessageDlqEvent): Promise<void> {
  const topic = this.configService.get<string>('KAFKA_TOPIC_MESSAGE_DLQ', 'message.dlq');
  await this.publish(topic, event.requestId, event);
}
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
yarn test libs/kafka/test/kafka.service.spec.ts --no-coverage
```

예상: 기존 + 신규 2개 포함 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add libs/kafka/src/kafka.service.ts libs/kafka/test/kafka.service.spec.ts
git commit -m "feat: KafkaService.publishDlq() — message.dlq 토픽 발행"
```

---

## Task 4: BaseWorkerService — !canRetry 시 DLQ 발행 + 워커 모듈 연동

**Files:**
- Modify: `libs/kafka/src/worker/base-worker.service.ts`
- Modify: `apps/worker-email/src/worker-email.module.ts`
- Modify: `apps/worker-sms/src/worker-sms.module.ts`
- Modify: `apps/worker-kakao/src/worker-kakao.module.ts`

### 변경 내용

`BaseWorkerService` constructor에 `@Optional() KafkaService` 추가. 현재 `!canRetry` 분기 (dispatch FAILED 처리 블록) 뒤에 DLQ 발행 추가. 워커 모듈 3개에 `KafkaModule` import 추가.

- [ ] **Step 1: base-worker.service.ts 수정**

`libs/kafka/src/worker/base-worker.service.ts`의 import에 추가:

```typescript
import { KafkaService } from '../kafka.service';
import { MessageDlqEvent } from '@app/contracts';
```

`Optional` 데코레이터를 기존 `Optional` import에 이미 있으므로 확인. (이전 암호화 구현에서 추가됨)

constructor 파라미터에 추가 (기존 `@Optional() payloadCryptoService` 뒤에):

```typescript
@Optional() private readonly kafkaService?: KafkaService,
```

`!canRetry` 분기의 `else` 블록 수정. 현재 코드 (약 165-176번 줄):

```typescript
} else {
  savedDispatch.status = MessageDispatchStatus.FAILED;
  savedDispatch.failedAt = new Date();
  savedDispatch.lastErrorCode = this.errorCode;
  savedDispatch.lastErrorMessage = errorMessage;
  await this.messageDispatchRepository.save(savedDispatch);
  await this.writeLog(savedDispatch.id, DispatchLogType.FAIL, DispatchLogStatus.FAILED, { error: errorMessage });

  messageRequest.status = MessageRequestStatus.FAILED;
  await this.messageRequestRepository.save(messageRequest);
}
```

다음으로 교체:

```typescript
} else {
  savedDispatch.status = MessageDispatchStatus.FAILED;
  savedDispatch.failedAt = new Date();
  savedDispatch.lastErrorCode = this.errorCode;
  savedDispatch.lastErrorMessage = errorMessage;
  await this.messageDispatchRepository.save(savedDispatch);
  await this.writeLog(savedDispatch.id, DispatchLogType.FAIL, DispatchLogStatus.FAILED, { error: errorMessage });

  messageRequest.status = MessageRequestStatus.FAILED;
  await this.messageRequestRepository.save(messageRequest);

  if (this.kafkaService) {
    const dlqEvent: MessageDlqEvent = {
      ...event,
      dispatchId: savedDispatch.id,
      errorCode: this.errorCode,
      errorMessage,
      retryCount: savedDispatch.retryCount,
      failedAt: (savedDispatch.failedAt as Date).toISOString(),
    };
    try {
      await this.kafkaService.publishDlq(dlqEvent);
    } catch (dlqError) {
      this.logger.error(
        `Failed to publish DLQ event for dispatch ${savedDispatch.id}`,
        dlqError instanceof Error ? dlqError.stack : dlqError,
      );
    }
  }
}
```

- [ ] **Step 2: 워커 모듈 3개에 KafkaModule 추가**

`apps/worker-email/src/worker-email.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  MessageDispatchEntity,
  MessageDispatchLogEntity,
  MessageRequestEntity,
  createTypeOrmConfig,
} from '@app/database';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '@app/kafka';
import { PayloadCryptoModule } from '@app/common';
import { WorkerEmailController } from './worker-email.controller';
import { WorkerEmailService } from './worker-email.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(createTypeOrmConfig([
      MessageRequestEntity,
      MessageDispatchEntity,
      MessageDispatchLogEntity,
    ])),
    TypeOrmModule.forFeature([MessageRequestEntity, MessageDispatchEntity, MessageDispatchLogEntity]),
    KafkaModule,
    PayloadCryptoModule,
  ],
  controllers: [WorkerEmailController],
  providers: [WorkerEmailService],
})
export class WorkerEmailModule {}
```

`apps/worker-sms/src/worker-sms.module.ts` (동일 패턴, WorkerSmsController/WorkerSmsService):

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  MessageDispatchEntity,
  MessageDispatchLogEntity,
  MessageRequestEntity,
  createTypeOrmConfig,
} from '@app/database';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '@app/kafka';
import { PayloadCryptoModule } from '@app/common';
import { WorkerSmsController } from './worker-sms.controller';
import { WorkerSmsService } from './worker-sms.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(createTypeOrmConfig([
      MessageRequestEntity,
      MessageDispatchEntity,
      MessageDispatchLogEntity,
    ])),
    TypeOrmModule.forFeature([MessageRequestEntity, MessageDispatchEntity, MessageDispatchLogEntity]),
    KafkaModule,
    PayloadCryptoModule,
  ],
  controllers: [WorkerSmsController],
  providers: [WorkerSmsService],
})
export class WorkerSmsModule {}
```

`apps/worker-kakao/src/worker-kakao.module.ts` (동일 패턴):

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  MessageDispatchEntity,
  MessageDispatchLogEntity,
  MessageRequestEntity,
  createTypeOrmConfig,
} from '@app/database';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '@app/kafka';
import { PayloadCryptoModule } from '@app/common';
import { WorkerKakaoController } from './worker-kakao.controller';
import { WorkerKakaoService } from './worker-kakao.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(createTypeOrmConfig([
      MessageRequestEntity,
      MessageDispatchEntity,
      MessageDispatchLogEntity,
    ])),
    TypeOrmModule.forFeature([MessageRequestEntity, MessageDispatchEntity, MessageDispatchLogEntity]),
    KafkaModule,
    PayloadCryptoModule,
  ],
  controllers: [WorkerKakaoController],
  providers: [WorkerKakaoService],
})
export class WorkerKakaoModule {}
```

- [ ] **Step 3: 전체 테스트 실행 — 회귀 없음 확인**

```bash
yarn test --no-coverage
```

예상: 기존 114개 테스트 모두 통과

- [ ] **Step 4: 커밋**

```bash
git add libs/kafka/src/worker/base-worker.service.ts \
        apps/worker-email/src/worker-email.module.ts \
        apps/worker-sms/src/worker-sms.module.ts \
        apps/worker-kakao/src/worker-kakao.module.ts
git commit -m "feat: BaseWorkerService — 최대 재시도 초과 시 DLQ Kafka 토픽 발행"
```

---

## Task 5: DlqConsumerService — main 앱 DLQ 소비자 (TDD)

**Files:**
- Create: `apps/main/test/modules/dlq/dlq-consumer.service.spec.ts`
- Create: `apps/main/src/modules/dlq/dlq-consumer.service.ts`

- [ ] **Step 1: 테스트 파일 작성**

`apps/main/test/modules/dlq/dlq-consumer.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ChannelType, MessageDlqEntity } from '@app/database';
import { MessageDlqEvent } from '@app/contracts';
import { DlqConsumerService } from '../../../src/modules/dlq/dlq-consumer.service';

function makeDlqEvent(overrides: Partial<MessageDlqEvent> = {}): MessageDlqEvent {
  return {
    messageRequestId: 'req-uuid',
    requestId: 'req-001',
    recipientId: 'rec-uuid',
    clientAppId: 'app-uuid',
    templateCode: 'WELCOME',
    channel: 'EMAIL',
    receiver: { email: 'user@example.com' },
    variables: { name: 'Alice' },
    priority: 'NORMAL',
    callbackUrl: null,
    requestedAt: new Date().toISOString(),
    dispatchId: 'dispatch-uuid',
    errorCode: 'EMAIL_SEND_FAILED',
    errorMessage: 'SMTP connection refused',
    retryCount: 3,
    failedAt: '2026-06-04T12:00:00.000Z',
    ...overrides,
  };
}

describe('DlqConsumerService', () => {
  let service: DlqConsumerService;
  let dlqRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    dlqRepo = { create: jest.fn(), save: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqConsumerService,
        { provide: getRepositoryToken(MessageDlqEntity), useValue: dlqRepo },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    service = module.get(DlqConsumerService);
  });

  describe('saveDlqEntry', () => {
    it('saves DLQ entry with all required fields', async () => {
      const event = makeDlqEvent();
      dlqRepo.create.mockReturnValue({ id: 'dlq-uuid' });
      dlqRepo.save.mockResolvedValue({ id: 'dlq-uuid' });

      await (service as unknown as { saveDlqEntry: (e: MessageDlqEvent) => Promise<void> })
        .saveDlqEntry(event);

      expect(dlqRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messageRequestId: 'req-uuid',
          dispatchId: 'dispatch-uuid',
          recipientId: 'rec-uuid',
          channelType: ChannelType.EMAIL,
          errorCode: 'EMAIL_SEND_FAILED',
          errorMessage: 'SMTP connection refused',
          retryCount: 3,
          failedAt: new Date('2026-06-04T12:00:00.000Z'),
        }),
      );
      expect(dlqRepo.save).toHaveBeenCalledTimes(1);
    });

    it('preserves full original event in originalEvent field', async () => {
      const event = makeDlqEvent();
      dlqRepo.create.mockReturnValue({ id: 'dlq-uuid' });
      dlqRepo.save.mockResolvedValue({ id: 'dlq-uuid' });

      await (service as unknown as { saveDlqEntry: (e: MessageDlqEvent) => Promise<void> })
        .saveDlqEntry(event);

      expect(dlqRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalEvent: expect.objectContaining({
            messageRequestId: 'req-uuid',
            errorCode: 'EMAIL_SEND_FAILED',
            variables: { name: 'Alice' },
          }),
        }),
      );
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
yarn test apps/main/test/modules/dlq/dlq-consumer.service.spec.ts --no-coverage
```

예상: `Cannot find module '../../src/modules/dlq/dlq-consumer.service'`

- [ ] **Step 3: DlqConsumerService 구현**

`apps/main/src/modules/dlq/dlq-consumer.service.ts`:

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consumer, Kafka } from 'kafkajs';
import { ChannelType, MessageDlqEntity } from '@app/database';
import { MessageDlqEvent } from '@app/contracts';

@Injectable()
export class DlqConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DlqConsumerService.name);
  private consumer!: Consumer;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(MessageDlqEntity)
    private readonly dlqRepository: Repository<MessageDlqEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const kafka = new Kafka({
      clientId: this.configService.get<string>('KAFKA_DLQ_CLIENT_ID', 'main-dlq-consumer'),
      brokers,
    });

    this.consumer = kafka.consumer({
      groupId: this.configService.get<string>('KAFKA_DLQ_CONSUMER_GROUP_ID', 'dlq-consumer-group'),
    });

    const topic = this.configService.get<string>('KAFKA_TOPIC_MESSAGE_DLQ', 'message.dlq');
    await this.consumer.connect();
    await this.consumer.subscribe({ topic, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const event = JSON.parse(message.value.toString()) as MessageDlqEvent;
          await this.saveDlqEntry(event);
        } catch (error) {
          this.logger.error(
            'Failed to process DLQ message',
            error instanceof Error ? error.stack : error,
          );
        }
      },
    });

    this.logger.log(`DLQ consumer started: topic=${topic}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }

  private async saveDlqEntry(event: MessageDlqEvent): Promise<void> {
    const entry = this.dlqRepository.create({
      messageRequestId: event.messageRequestId,
      dispatchId: event.dispatchId,
      recipientId: event.recipientId,
      channelType: event.channel as ChannelType,
      errorCode: event.errorCode,
      errorMessage: event.errorMessage,
      retryCount: event.retryCount,
      originalEvent: event as unknown as Record<string, unknown>,
      failedAt: new Date(event.failedAt),
    });
    await this.dlqRepository.save(entry);
    this.logger.log(
      `DLQ entry saved: messageRequestId=${event.messageRequestId}, dispatchId=${event.dispatchId}`,
    );
  }
}
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
yarn test apps/main/test/modules/dlq/dlq-consumer.service.spec.ts --no-coverage
```

예상: 2개 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add apps/main/src/modules/dlq/dlq-consumer.service.ts \
        apps/main/test/modules/dlq/dlq-consumer.service.spec.ts
git commit -m "feat: DlqConsumerService — message.dlq 구독 및 MessageDlqEntity 저장"
```

---

## Task 6: MainModule — DlqConsumerService 및 MessageDlqEntity 등록

**Files:**
- Modify: `apps/main/src/main.module.ts`

- [ ] **Step 1: main.module.ts 수정**

`apps/main/src/main.module.ts` 전체:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '@app/kafka';
import { PayloadCryptoModule } from '@app/common';
import {
  MessageDispatchEntity,
  MessageDlqEntity,
  MessageOutboxEntity,
  MessagePayloadEntity,
  MessageRecipientEntity,
  MessageRequestEntity,
  createTypeOrmConfig,
} from '@app/database';
import { MainController } from './main.controller';
import { MainService } from './main.service';
import { RetrySchedulerService } from './modules/retry-scheduler/retry-scheduler.service';
import { OutboxRelayService } from './modules/outbox-relay/outbox-relay.service';
import { DlqConsumerService } from './modules/dlq/dlq-consumer.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot(createTypeOrmConfig([
      MessageRequestEntity,
      MessageDispatchEntity,
      MessagePayloadEntity,
      MessageRecipientEntity,
      MessageOutboxEntity,
      MessageDlqEntity,
    ])),
    TypeOrmModule.forFeature([
      MessageRequestEntity,
      MessageDispatchEntity,
      MessagePayloadEntity,
      MessageRecipientEntity,
      MessageOutboxEntity,
      MessageDlqEntity,
    ]),
    KafkaModule,
    PayloadCryptoModule,
  ],
  controllers: [MainController],
  providers: [MainService, RetrySchedulerService, OutboxRelayService, DlqConsumerService],
})
export class MainModule { }
```

- [ ] **Step 2: 전체 테스트 실행 — 회귀 없음 확인**

```bash
yarn test --no-coverage
```

예상: 기존 테스트 + 신규 2개 포함 모두 통과

- [ ] **Step 3: 커밋**

```bash
git add apps/main/src/main.module.ts
git commit -m "feat: MainModule — DlqConsumerService + MessageDlqEntity 등록"
```

---

## Task 7: Admin DLQ 조회 모듈 (TDD)

**Files:**
- Create: `apps/admin-api/test/modules/dlq/dlq.controller.spec.ts`
- Create: `apps/admin-api/src/modules/dlq/dlq.service.ts`
- Create: `apps/admin-api/src/modules/dlq/dlq.controller.ts`
- Create: `apps/admin-api/src/modules/dlq/dlq.module.ts`

- [ ] **Step 1: 테스트 파일 작성**

`apps/admin-api/test/modules/dlq/dlq.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DlqController } from '../../../src/modules/dlq/dlq.controller';
import { DlqService } from '../../../src/modules/dlq/dlq.service';
import { AdminAuthGuard } from '../../../src/guards/admin-auth.guard';

describe('DlqController', () => {
  let controller: DlqController;
  let dlqService: { findAll: jest.Mock };

  beforeEach(async () => {
    dlqService = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DlqController],
      providers: [{ provide: DlqService, useValue: dlqService }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DlqController);
  });

  it('findAll returns paginated DLQ entries', async () => {
    const mockResult = { data: [], total: 0, page: 1, limit: 20 };
    dlqService.findAll.mockResolvedValue(mockResult);

    const result = await controller.findAll('1', '20');

    expect(dlqService.findAll).toHaveBeenCalledWith(1, 20);
    expect(result).toEqual(mockResult);
  });

  it('clamps limit to 100 maximum', async () => {
    dlqService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });

    await controller.findAll('1', '999');

    expect(dlqService.findAll).toHaveBeenCalledWith(1, 100);
  });

  it('uses default page 1 and limit 20 when not provided', async () => {
    dlqService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    await controller.findAll('1', '20');

    expect(dlqService.findAll).toHaveBeenCalledWith(1, 20);
  });
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
yarn test apps/admin-api/test/modules/dlq/dlq.controller.spec.ts --no-coverage
```

예상: `Cannot find module '../../src/modules/dlq/dlq.controller'`

- [ ] **Step 3: DlqService 구현**

`apps/admin-api/src/modules/dlq/dlq.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageDlqEntity } from '@app/database';

@Injectable()
export class DlqService {
  constructor(
    @InjectRepository(MessageDlqEntity)
    private readonly dlqRepository: Repository<MessageDlqEntity>,
  ) {}

  async findAll(
    page: number,
    limit: number,
  ): Promise<{ data: MessageDlqEntity[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.dlqRepository.findAndCount({
      order: { failedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }
}
```

- [ ] **Step 4: DlqController 구현**

`apps/admin-api/src/modules/dlq/dlq.controller.ts`:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { DlqService } from './dlq.service';

@ApiTags('Dead Letter Queue')
@ApiHeader({ name: 'x-api-key', required: true, description: 'Admin API Key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: 'Admin API Key Secret' })
@UseGuards(AdminAuthGuard)
@Controller('admin/dlq')
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}

  @ApiOperation({ summary: 'DLQ 목록 조회 (최신순)' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호 (기본값: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 건수 (기본값: 20, 최대: 100)' })
  @ApiOkResponse({ description: 'DLQ 목록 반환' })
  @ApiUnauthorizedResponse({ description: 'Admin 키 인증 실패' })
  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.dlqService.findAll(Number(page), Math.min(Number(limit), 100));
  }
}
```

- [ ] **Step 5: DlqModule 생성**

`apps/admin-api/src/modules/dlq/dlq.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientApiKeyEntity, ClientAppEntity, MessageDlqEntity } from '@app/database';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { DlqController } from './dlq.controller';
import { DlqService } from './dlq.service';

@Module({
  imports: [TypeOrmModule.forFeature([MessageDlqEntity, ClientAppEntity, ClientApiKeyEntity])],
  controllers: [DlqController],
  providers: [DlqService, AdminAuthGuard],
})
export class DlqModule {}
```

- [ ] **Step 6: 테스트 실행 — PASS 확인**

```bash
yarn test apps/admin-api/test/modules/dlq/dlq.controller.spec.ts --no-coverage
```

예상: 3개 테스트 통과

- [ ] **Step 7: 커밋**

```bash
git add apps/admin-api/src/modules/dlq/ apps/admin-api/test/modules/dlq/
git commit -m "feat: Admin DLQ 조회 모듈 — GET /admin/dlq (페이지네이션)"
```

---

## Task 8: AdminApiModule 업데이트

**Files:**
- Modify: `apps/admin-api/src/admin-api.module.ts`

- [ ] **Step 1: admin-api.module.ts 수정**

`apps/admin-api/src/admin-api.module.ts` 전체:

```typescript
import { APP_INTERCEPTOR, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientApiKeyEntity, ClientAppEntity, MessageDlqEntity, createTypeOrmConfig } from '@app/database';
import { HttpMetricsInterceptor, MetricsModule } from '@app/common';
import { AdminApiController } from './admin-api.controller';
import { AdminApiService } from './admin-api.service';
import { ClientApiKeyModule } from './modules/client-api-key/client-api-key.module';
import { DlqModule } from './modules/dlq/dlq.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    TypeOrmModule.forRoot(createTypeOrmConfig([ClientAppEntity, ClientApiKeyEntity, MessageDlqEntity])),
    ClientApiKeyModule,
    DlqModule,
    MetricsModule,
  ],
  controllers: [AdminApiController],
  providers: [
    AdminApiService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AdminApiModule { }
```

- [ ] **Step 2: 전체 테스트 실행 — 최종 확인**

```bash
yarn test --no-coverage
```

예상: 신규 5개 포함 모든 테스트 통과 (kafka.service 2개 + dlq-consumer 2개 + dlq.controller 3개)

- [ ] **Step 3: 커밋**

```bash
git add apps/admin-api/src/admin-api.module.ts
git commit -m "feat: AdminApiModule — DlqModule + MessageDlqEntity TypeORM 등록"
```

---

## Task 9: 환경변수 문서화 및 최종 정리

**Files:**
- Modify: `.env.example`
- Modify: `.env`

- [ ] **Step 1: .env.example 업데이트**

`Payload Encryption` 섹션 아래에 추가:

```bash
# ──────────────────────────────────────────
# Dead Letter Queue (DLQ)
# ──────────────────────────────────────────
# DLQ Kafka 토픽 이름
KAFKA_TOPIC_MESSAGE_DLQ=message.dlq

# DLQ consumer (main 앱)
KAFKA_DLQ_CLIENT_ID=main-dlq-consumer
KAFKA_DLQ_CONSUMER_GROUP_ID=dlq-consumer-group
```

- [ ] **Step 2: .env 업데이트**

`.env` 파일 끝에 추가:

```bash
KAFKA_TOPIC_MESSAGE_DLQ=message.dlq
KAFKA_DLQ_CLIENT_ID=main-dlq-consumer
KAFKA_DLQ_CONSUMER_GROUP_ID=dlq-consumer-group
```

- [ ] **Step 3: README Future Improvements 업데이트**

`README.md`의 Future Improvements에서 DLQ 항목을 체크:

```markdown
- [x] Dead Letter Queue — 최대 재시도 초과 시 DLQ 토픽 전송
```

테스트 수 업데이트 (114 → 신규 추가 수 반영):

```bash
yarn test --no-coverage 2>&1 | grep "Tests:"
```

나온 숫자로 README의 `**NNN개 단위 테스트**` 업데이트.

- [ ] **Step 4: 최종 커밋**

```bash
git add .env.example .env README.md
git commit -m "chore: DLQ 환경변수 문서화 및 README 업데이트"
```

---

## 구현 후 확인 체크리스트

- [ ] `yarn test --no-coverage` 전체 통과
- [ ] `KafkaService.publishDlq` 테스트 통과
- [ ] `DlqConsumerService.saveDlqEntry` 테스트 통과
- [ ] `DlqController.findAll` 테스트 통과 (limit clamping 포함)
- [ ] TypeScript 컴파일 오류 없음 (기존 pre-existing 제외)
- [ ] `.env`에 `KAFKA_TOPIC_MESSAGE_DLQ` 설정됨
