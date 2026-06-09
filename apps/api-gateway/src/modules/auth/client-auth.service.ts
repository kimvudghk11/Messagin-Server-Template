import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ApiKeyStatus,
  ApiKeyType,
  ClientApiKeyEntity,
  ClientAppEntity,
  ClientAppStatus,
  ClientIpWhitelistEntity,
} from '@app/database';
import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '@app/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface AuthenticatedClient {
  clientAppId: string;
  appCode: string;
  apiKeyId: string;
  keyType: ApiKeyType;
  rateLimitPerMinute: number;
}

export interface HeaderAccessibleRequest {
  header(name: string): string | undefined;
  ip?: string | undefined;
}

@Injectable()
export class ClientAuthService {
  constructor(
    @InjectRepository(ClientApiKeyEntity)
    private readonly clientApiKeyRepository: Repository<ClientApiKeyEntity>,
    @InjectRepository(ClientAppEntity)
    private readonly clientAppRepository: Repository<ClientAppEntity>,
    @InjectRepository(ClientIpWhitelistEntity)
    private readonly ipWhitelistRepository: Repository<ClientIpWhitelistEntity>,
  ) { }

  async authenticate(request: HeaderAccessibleRequest): Promise<AuthenticatedClient> {
    const keyId = request.header('x-api-key');
    const plainSecret = request.header('x-api-secret');

    if (!keyId || !plainSecret) {
      throw new AppException(ErrorCode.AUTH_MISSING_HEADERS, 401);
    }

    const apiKey = await this.clientApiKeyRepository.findOne({ where: { keyId } });
    if (!apiKey) {
      throw new AppException(ErrorCode.AUTH_INVALID_API_KEY, 401);
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

    if (clientApp.isIpWhitelistEnabled) {
      const clientIp = this.extractClientIp(request);
      await this.assertIpAllowed(clientApp.id, clientIp);
    }

    apiKey.lastUsedAt = new Date();
    await this.clientApiKeyRepository.save(apiKey);

    return {
      clientAppId: clientApp.id,
      appCode: clientApp.appCode,
      apiKeyId: apiKey.id,
      keyType: apiKey.keyType,
      rateLimitPerMinute: clientApp.rateLimitPerMinute,
    };
  }

  private extractClientIp(request: HeaderAccessibleRequest): string {
    const forwarded = request.header('x-forwarded-for');
    if (forwarded) {
      // Rightmost IP is appended by the last trusted proxy — not client-controlled.
      // Requires the reverse proxy to strip and rewrite X-Forwarded-For.
      const ips = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
      const last = ips[ips.length - 1];
      if (last) return last;
    }
    return request.ip ?? '0.0.0.0';
  }

  private async assertIpAllowed(clientAppId: string, clientIp: string): Promise<void> {
    const result = await this.ipWhitelistRepository
      .createQueryBuilder('wl')
      .where('wl.client_app_id = :clientAppId', { clientAppId })
      .andWhere('wl.is_active = :isActive', { isActive: true })
      .andWhere(':ip::inet << wl.ip_address', { ip: clientIp })
      .getOne();

    if (!result) {
      throw new AppException(ErrorCode.AUTH_IP_NOT_ALLOWED, 401);
    }
  }
}
