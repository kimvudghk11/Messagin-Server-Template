import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyStatus, ApiKeyType, ClientApiKeyEntity, ClientAppEntity, ClientAppStatus } from '@app/database';
import { AppException, ErrorCode } from '@app/common';
import { Request } from 'express';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(ClientApiKeyEntity)
    private readonly clientApiKeyRepository: Repository<ClientApiKeyEntity>,
    @InjectRepository(ClientAppEntity)
    private readonly clientAppRepository: Repository<ClientAppEntity>,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const keyId = request.header('x-api-key');
    const plainSecret = request.header('x-api-secret');

    if (!keyId || !plainSecret) {
      throw new AppException(ErrorCode.AUTH_MISSING_HEADERS, 401);
    }

    const apiKey = await this.clientApiKeyRepository.findOne({ where: { keyId } });
    if (!apiKey) {
      throw new AppException(ErrorCode.AUTH_INVALID_API_KEY, 401);
    }

    if (apiKey.keyType !== ApiKeyType.ADMIN) {
      throw new AppException(ErrorCode.AUTH_ADMIN_REQUIRED, 401);
    }

    if (apiKey.status !== ApiKeyStatus.ACTIVE) {
      throw new AppException(ErrorCode.AUTH_API_KEY_INACTIVE, 401);
    }

    if (apiKey.expiredAt && apiKey.expiredAt.getTime() <= Date.now()) {
      throw new AppException(ErrorCode.AUTH_API_KEY_EXPIRED, 401);
    }

    const secretHash = createHash('sha256').update(plainSecret).digest('hex');
    const left = Buffer.from(secretHash, 'utf8');
    const right = Buffer.from(apiKey.secretHash, 'utf8');

    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new AppException(ErrorCode.AUTH_INVALID_SECRET, 401);
    }

    const clientApp = await this.clientAppRepository.findOne({ where: { id: apiKey.clientAppId } });
    if (!clientApp || clientApp.status !== ClientAppStatus.ACTIVE) {
      throw new AppException(ErrorCode.AUTH_CLIENT_APP_INACTIVE, 401);
    }

    apiKey.lastUsedAt = new Date();
    await this.clientApiKeyRepository.save(apiKey);

    (request as unknown as Record<string, unknown>)['adminKeyId'] = apiKey.id;

    return true;
  }
}
