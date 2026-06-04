# Admin Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 액션 시 `tb_admin_audit_log`에 감사 로그를 기록하고, `GET /admin/audit-logs`로 조회할 수 있도록 한다.

**Architecture:** `AdminAuthGuard`가 인증 성공 후 `request['adminKeyId']`를 설정 → `ClientApiKeyController`가 key 생성 후 `AdminAuditLogService.log()` 호출 → `AdminAuditLogController`의 GET 엔드포인트로 조회. `AdminAuditLogEntity`는 이미 존재하므로 DB 마이그레이션 없음.

**Tech Stack:** NestJS, TypeORM (PostgreSQL), Express Request, `@nestjs/swagger`

---

## File Map

| Action | Path | 역할 |
|--------|------|------|
| Modify | `apps/admin-api/src/guards/admin-auth.guard.ts` | 인증 후 `request['adminKeyId']` 설정 |
| Modify | `apps/admin-api/test/guards/admin-auth.guard.spec.ts` | adminKeyId 설정 테스트 추가 |
| Create | `apps/admin-api/src/modules/audit-log/admin-audit-log.service.ts` | log() + findAll() |
| Create | `apps/admin-api/src/modules/audit-log/admin-audit-log.controller.ts` | GET /admin/audit-logs |
| Create | `apps/admin-api/src/modules/audit-log/admin-audit-log.module.ts` | NestJS 모듈 |
| Create | `apps/admin-api/test/modules/audit-log/admin-audit-log.service.spec.ts` | 서비스 단위 테스트 |
| Create | `apps/admin-api/test/modules/audit-log/admin-audit-log.controller.spec.ts` | 컨트롤러 단위 테스트 |
| Modify | `apps/admin-api/src/modules/client-api-key/client-api-key.controller.ts` | audit log 호출 추가 |
| Modify | `apps/admin-api/src/modules/client-api-key/client-api-key.module.ts` | AdminAuditLogModule import |
| Modify | `apps/admin-api/src/admin-api.module.ts` | AdminAuditLogEntity + AdminAuditLogModule |
| Modify | `README.md` | What's Implemented 업데이트 |

---

## Task 1: AdminAuthGuard — request에 adminKeyId 설정 (TDD)

**Files:**
- Modify: `apps/admin-api/test/guards/admin-auth.guard.spec.ts`
- Modify: `apps/admin-api/src/guards/admin-auth.guard.ts`

- [ ] **Step 1: 기존 테스트에 adminKeyId 검증 케이스 추가**

`apps/admin-api/test/guards/admin-auth.guard.spec.ts`의 기존 테스트 뒤에 추가:

```typescript
it('sets adminKeyId on request after successful auth', async () => {
  apiKeyRepo.findOne.mockResolvedValue(makeApiKey());
  apiKeyRepo.save.mockResolvedValue({});
  appRepo.findOne.mockResolvedValue(makeClientApp());

  const request: Record<string, unknown> = {
    header: (name: string): string | undefined => {
      if (name === 'x-api-key') return 'mst_live_admin123';
      if (name === 'x-api-secret') return PLAIN_SECRET;
      return undefined;
    },
  };
  const ctx = makeHttpExecutionContext(request);

  await guard.canActivate(ctx);

  expect(request['adminKeyId']).toBe('admin-key-uuid');
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
yarn test apps/admin-api/test/guards/admin-auth.guard.spec.ts --no-coverage
```

예상: `expect(received).toBe(expected) — received undefined`

- [ ] **Step 3: AdminAuthGuard 수정**

`apps/admin-api/src/guards/admin-auth.guard.ts`의 `apiKey.lastUsedAt` 업데이트와 `return true` 사이에 추가:

```typescript
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const keyId = request.header('x-api-key');
    const plainSecret = request.header('x-api-secret');

    if (!keyId || !plainSecret) {
      throw new UnauthorizedException('Missing API key headers');
    }

    const apiKey = await this.clientApiKeyRepository.findOne({ where: { keyId } });
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.keyType !== ApiKeyType.ADMIN) {
      throw new UnauthorizedException('Admin access required');
    }

    if (apiKey.status !== ApiKeyStatus.ACTIVE) {
      throw new UnauthorizedException('API key is not active');
    }

    if (apiKey.expiredAt && apiKey.expiredAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('API key expired');
    }

    const secretHash = createHash('sha256').update(plainSecret).digest('hex');
    const left = Buffer.from(secretHash, 'utf8');
    const right = Buffer.from(apiKey.secretHash, 'utf8');

    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException('Invalid API secret');
    }

    const clientApp = await this.clientAppRepository.findOne({ where: { id: apiKey.clientAppId } });
    if (!clientApp || clientApp.status !== ClientAppStatus.ACTIVE) {
      throw new UnauthorizedException('Client app is not active');
    }

    apiKey.lastUsedAt = new Date();
    await this.clientApiKeyRepository.save(apiKey);

    (request as Record<string, unknown>)['adminKeyId'] = apiKey.id;

    return true;
  }
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
yarn test apps/admin-api/test/guards/admin-auth.guard.spec.ts --no-coverage
```

예상: 기존 12개 + 신규 1개 = 13개 통과

- [ ] **Step 5: 커밋**

```bash
git add apps/admin-api/src/guards/admin-auth.guard.ts apps/admin-api/test/guards/admin-auth.guard.spec.ts
git commit -m "feat: AdminAuthGuard — 인증 성공 시 request['adminKeyId'] 설정"
```

---

## Task 2: AdminAuditLogService (TDD)

**Files:**
- Create: `apps/admin-api/test/modules/audit-log/admin-audit-log.service.spec.ts`
- Create: `apps/admin-api/src/modules/audit-log/admin-audit-log.service.ts`

- [ ] **Step 1: 서비스 테스트 파일 작성**

`apps/admin-api/test/modules/audit-log/admin-audit-log.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminActionType, AdminAuditLogEntity, AdminTargetType } from '@app/database';
import { AdminAuditLogService } from '../../../src/modules/audit-log/admin-audit-log.service';

describe('AdminAuditLogService', () => {
  let service: AdminAuditLogService;
  let auditLogRepo: { create: jest.Mock; save: jest.Mock; findAndCount: jest.Mock };

  beforeEach(async () => {
    auditLogRepo = { create: jest.fn(), save: jest.fn(), findAndCount: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditLogService,
        { provide: getRepositoryToken(AdminAuditLogEntity), useValue: auditLogRepo },
      ],
    }).compile();

    service = module.get(AdminAuditLogService);
  });

  describe('log', () => {
    it('saves audit log entry with all required fields', async () => {
      auditLogRepo.create.mockReturnValue({ id: 'log-uuid' });
      auditLogRepo.save.mockResolvedValue({ id: 'log-uuid' });

      await service.log({
        adminKeyId: 'admin-key-uuid',
        actionType: AdminActionType.CREATE_API_KEY,
        targetType: AdminTargetType.API_KEY,
        targetId: 'new-key-uuid',
        afterData: { keyId: 'mst_test_abc', keyName: 'test key', keyType: 'SERVER' },
        ip: '127.0.0.1',
        userAgent: 'curl/7.79.1',
      });

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-key-uuid',
          actionType: AdminActionType.CREATE_API_KEY,
          targetType: AdminTargetType.API_KEY,
          targetId: 'new-key-uuid',
          beforeData: null,
          afterData: { keyId: 'mst_test_abc', keyName: 'test key', keyType: 'SERVER' },
          ipAddress: '127.0.0.1',
          userAgent: 'curl/7.79.1',
        }),
      );
      expect(auditLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('uses null for optional fields when not provided', async () => {
      auditLogRepo.create.mockReturnValue({ id: 'log-uuid' });
      auditLogRepo.save.mockResolvedValue({ id: 'log-uuid' });

      await service.log({
        adminKeyId: 'admin-key-uuid',
        actionType: AdminActionType.CREATE_API_KEY,
        targetType: AdminTargetType.API_KEY,
      });

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: null,
          beforeData: null,
          afterData: null,
          ipAddress: null,
          userAgent: null,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated audit log entries', async () => {
      const mockEntry = { id: 'log-uuid' } as AdminAuditLogEntity;
      auditLogRepo.findAndCount.mockResolvedValue([[mockEntry], 1]);

      const result = await service.findAll(1, 20);

      expect(auditLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toEqual({ data: [mockEntry], total: 1, page: 1, limit: 20 });
    });

    it('calculates correct skip for page 2', async () => {
      auditLogRepo.findAndCount.mockResolvedValue([[], 50]);

      await service.findAll(2, 10);

      expect(auditLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
yarn test apps/admin-api/test/modules/audit-log/admin-audit-log.service.spec.ts --no-coverage
```

예상: `Cannot find module '../../src/modules/audit-log/admin-audit-log.service'`

- [ ] **Step 3: AdminAuditLogService 구현**

`apps/admin-api/src/modules/audit-log/admin-audit-log.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminActionType, AdminAuditLogEntity, AdminTargetType } from '@app/database';

export interface AuditLogParams {
  adminKeyId: string;
  actionType: AdminActionType;
  targetType: AdminTargetType;
  targetId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AdminAuditLogService {
  constructor(
    @InjectRepository(AdminAuditLogEntity)
    private readonly auditLogRepository: Repository<AdminAuditLogEntity>,
  ) {}

  async log(params: AuditLogParams): Promise<void> {
    const entry = this.auditLogRepository.create({
      adminUserId: params.adminKeyId,
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      beforeData: params.beforeData ?? null,
      afterData: params.afterData ?? null,
      ipAddress: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    });
    await this.auditLogRepository.save(entry);
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<{ data: AdminAuditLogEntity[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.auditLogRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }
}
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
yarn test apps/admin-api/test/modules/audit-log/admin-audit-log.service.spec.ts --no-coverage
```

예상: 4개 테스트 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add apps/admin-api/src/modules/audit-log/admin-audit-log.service.ts \
        apps/admin-api/test/modules/audit-log/admin-audit-log.service.spec.ts
git commit -m "feat: AdminAuditLogService — log() + findAll() 구현"
```

---

## Task 3: AdminAuditLogController + Module (TDD)

**Files:**
- Create: `apps/admin-api/test/modules/audit-log/admin-audit-log.controller.spec.ts`
- Create: `apps/admin-api/src/modules/audit-log/admin-audit-log.controller.ts`
- Create: `apps/admin-api/src/modules/audit-log/admin-audit-log.module.ts`

- [ ] **Step 1: 컨트롤러 테스트 파일 작성**

`apps/admin-api/test/modules/audit-log/admin-audit-log.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuditLogController } from '../../../src/modules/audit-log/admin-audit-log.controller';
import { AdminAuditLogService } from '../../../src/modules/audit-log/admin-audit-log.service';
import { AdminAuthGuard } from '../../../src/guards/admin-auth.guard';

describe('AdminAuditLogController', () => {
  let controller: AdminAuditLogController;
  let auditLogService: { findAll: jest.Mock };

  beforeEach(async () => {
    auditLogService = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditLogController],
      providers: [{ provide: AdminAuditLogService, useValue: auditLogService }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminAuditLogController);
  });

  it('findAll returns paginated audit log entries', async () => {
    const mockResult = { data: [], total: 0, page: 1, limit: 20 };
    auditLogService.findAll.mockResolvedValue(mockResult);

    const result = await controller.findAll('1', '20');

    expect(auditLogService.findAll).toHaveBeenCalledWith(1, 20);
    expect(result).toEqual(mockResult);
  });

  it('clamps limit to 100 maximum', async () => {
    auditLogService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });

    await controller.findAll('1', '999');

    expect(auditLogService.findAll).toHaveBeenCalledWith(1, 100);
  });

  it('uses default page 1 and limit 20', async () => {
    auditLogService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    await controller.findAll('1', '20');

    expect(auditLogService.findAll).toHaveBeenCalledWith(1, 20);
  });
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
yarn test apps/admin-api/test/modules/audit-log/admin-audit-log.controller.spec.ts --no-coverage
```

예상: `Cannot find module '../../src/modules/audit-log/admin-audit-log.controller'`

- [ ] **Step 3: AdminAuditLogController 구현**

`apps/admin-api/src/modules/audit-log/admin-audit-log.controller.ts`:

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
import { AdminAuditLogService } from './admin-audit-log.service';

@ApiTags('Admin 감사 로그')
@ApiHeader({ name: 'x-api-key', required: true, description: 'Admin API Key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: 'Admin API Key Secret' })
@UseGuards(AdminAuthGuard)
@Controller('admin/audit-logs')
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  @ApiOperation({ summary: 'Admin 감사 로그 목록 조회 (최신순)' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호 (기본값: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 건수 (기본값: 20, 최대: 100)' })
  @ApiOkResponse({ description: '감사 로그 목록 반환' })
  @ApiUnauthorizedResponse({ description: 'Admin 키 인증 실패' })
  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.auditLogService.findAll(Number(page), Math.min(Number(limit), 100));
  }
}
```

- [ ] **Step 4: AdminAuditLogModule 생성**

`apps/admin-api/src/modules/audit-log/admin-audit-log.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLogEntity, ClientApiKeyEntity, ClientAppEntity } from '@app/database';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { AdminAuditLogController } from './admin-audit-log.controller';
import { AdminAuditLogService } from './admin-audit-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAuditLogEntity, ClientAppEntity, ClientApiKeyEntity])],
  controllers: [AdminAuditLogController],
  providers: [AdminAuditLogService, AdminAuthGuard],
  exports: [AdminAuditLogService],
})
export class AdminAuditLogModule {}
```

- [ ] **Step 5: 테스트 실행 — PASS 확인**

```bash
yarn test apps/admin-api/test/modules/audit-log/admin-audit-log.controller.spec.ts --no-coverage
```

예상: 3개 테스트 통과

- [ ] **Step 6: 커밋**

```bash
git add apps/admin-api/src/modules/audit-log/ apps/admin-api/test/modules/audit-log/
git commit -m "feat: AdminAuditLogController + AdminAuditLogModule — GET /admin/audit-logs"
```

---

## Task 4: ClientApiKeyController — 감사 로그 호출 추가

**Files:**
- Modify: `apps/admin-api/src/modules/client-api-key/client-api-key.controller.ts`
- Modify: `apps/admin-api/src/modules/client-api-key/client-api-key.module.ts`

- [ ] **Step 1: ClientApiKeyController 수정**

`apps/admin-api/src/modules/client-api-key/client-api-key.controller.ts` 전체:

```typescript
import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AdminActionType, AdminTargetType } from '@app/database';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { AdminAuditLogService } from '../audit-log/admin-audit-log.service';
import { ClientApiKeyService } from './client-api-key.service';
import { CreateClientApiKeyDto } from './dto/create-client-api-key.dto';

@ApiTags('관리자 클라이언트 API Key')
@ApiHeader({ name: 'x-api-key', required: true, description: 'Admin API Key ID' })
@ApiHeader({ name: 'x-api-secret', required: true, description: 'Admin API Key Secret' })
@UseGuards(AdminAuthGuard)
@Controller('admin/client-apps/:clientAppId/api-keys')
export class ClientApiKeyController {
  constructor(
    private readonly clientApiKeyService: ClientApiKeyService,
    private readonly auditLogService: AdminAuditLogService,
  ) {}

  @ApiOperation({ summary: '클라이언트 앱 API Key 발급' })
  @ApiParam({ name: 'clientAppId', description: '클라이언트 앱 UUID' })
  @ApiBody({ type: CreateClientApiKeyDto })
  @ApiCreatedResponse({ description: 'API Key 발급 완료' })
  @ApiUnauthorizedResponse({ description: 'Admin 키 인증 실패' })
  @Post()
  async create(
    @Param('clientAppId') clientAppId: string,
    @Body() dto: CreateClientApiKeyDto,
    @Req() req: Request,
  ) {
    const result = await this.clientApiKeyService.create(clientAppId, dto);

    await this.auditLogService.log({
      adminKeyId: (req as Record<string, unknown>)['adminKeyId'] as string,
      actionType: AdminActionType.CREATE_API_KEY,
      targetType: AdminTargetType.API_KEY,
      targetId: result.id,
      afterData: {
        keyId: result.keyId,
        keyName: result.keyName,
        keyType: result.keyType,
        clientAppId: result.clientAppId,
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }
}
```

- [ ] **Step 2: ClientApiKeyModule에 AdminAuditLogModule 추가**

`apps/admin-api/src/modules/client-api-key/client-api-key.module.ts` 전체:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientApiKeyEntity, ClientAppEntity } from '@app/database';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import { AdminAuditLogModule } from '../audit-log/admin-audit-log.module';
import { ClientApiKeyController } from './client-api-key.controller';
import { ClientApiKeyService } from './client-api-key.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientAppEntity, ClientApiKeyEntity]),
    AdminAuditLogModule,
  ],
  controllers: [ClientApiKeyController],
  providers: [ClientApiKeyService, AdminAuthGuard],
})
export class ClientApiKeyModule {}
```

- [ ] **Step 3: 전체 테스트 실행 — 회귀 없음 확인**

```bash
yarn test --no-coverage
```

예상: 모든 기존 테스트 + 신규 테스트 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/admin-api/src/modules/client-api-key/client-api-key.controller.ts \
        apps/admin-api/src/modules/client-api-key/client-api-key.module.ts
git commit -m "feat: ClientApiKeyController — API Key 발급 시 감사 로그 기록"
```

---

## Task 5: AdminApiModule — 엔티티 및 모듈 등록

**Files:**
- Modify: `apps/admin-api/src/admin-api.module.ts`

- [ ] **Step 1: admin-api.module.ts 수정**

`apps/admin-api/src/admin-api.module.ts` 전체:

```typescript
import { APP_INTERCEPTOR, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminAuditLogEntity,
  ClientApiKeyEntity,
  ClientAppEntity,
  createTypeOrmConfig,
} from '@app/database';
import { HttpMetricsInterceptor, MetricsModule } from '@app/common';
import { AdminApiController } from './admin-api.controller';
import { AdminApiService } from './admin-api.service';
import { AdminAuditLogModule } from './modules/audit-log/admin-audit-log.module';
import { ClientApiKeyModule } from './modules/client-api-key/client-api-key.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    TypeOrmModule.forRoot(
      createTypeOrmConfig([ClientAppEntity, ClientApiKeyEntity, AdminAuditLogEntity]),
    ),
    ClientApiKeyModule,
    AdminAuditLogModule,
    MetricsModule,
  ],
  controllers: [AdminApiController],
  providers: [
    AdminApiService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AdminApiModule {}
```

- [ ] **Step 2: 전체 테스트 실행 — 최종 확인**

```bash
yarn test --no-coverage
```

예상: 신규 (guard 1 + service 4 + controller 3) = 8개 추가, 기존 테스트 전부 유지

실제 테스트 수 확인:
```bash
yarn test --no-coverage 2>&1 | grep "Tests:"
```

- [ ] **Step 3: 커밋**

```bash
git add apps/admin-api/src/admin-api.module.ts
git commit -m "feat: AdminApiModule — AdminAuditLogEntity + AdminAuditLogModule 등록"
```

---

## Task 6: README 및 최종 정리

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README What's Implemented 업데이트**

`README.md`의 What's Implemented 표에서 `페이로드 암호화` 행 뒤에 추가:

```markdown
| Admin 감사 로그 | ✅ | API Key 발급 시 `tb_admin_audit_log` 기록, `GET /admin/audit-logs` 조회 |
```

- [ ] **Step 2: Future Improvements 업데이트**

`Admin 감사 로그` 항목을 완료로 표시:

```markdown
- [x] Admin 감사 로그 — `tb_admin_audit_log` 실제 기록 (설계·플랜 완료, 구현 예정)
```

→

```markdown
- [x] Admin 감사 로그 — `tb_admin_audit_log` 실제 기록
```

테스트 수 업데이트:

```bash
yarn test --no-coverage 2>&1 | grep "Tests:"
```

나온 숫자로 `**NNN개 단위 테스트**` 업데이트.

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: Admin 감사 로그 구현 완료 표시 및 테스트 수 업데이트"
```

---

## 구현 후 확인 체크리스트

- [ ] `yarn test --no-coverage` 전체 통과
- [ ] `admin-auth.guard.spec.ts` — `request['adminKeyId']` 설정 테스트 포함
- [ ] `admin-audit-log.service.spec.ts` — `log()` 필드 매핑 + `findAll()` 페이지네이션 검증
- [ ] `admin-audit-log.controller.spec.ts` — limit clamping 포함
- [ ] `AdminApiModule` TypeORM에 `AdminAuditLogEntity` 포함됨
- [ ] `ClientApiKeyController.create()` — `@Req()` 포함, audit log 호출
