import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyStatus, ApiKeyType, ClientApiKeyEntity, ClientAppEntity, ClientAppStatus } from '@app/database';
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

    (request as unknown as Record<string, unknown>)['adminKeyId'] = apiKey.id;

    return true;
  }
}
