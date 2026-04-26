import { createHash, timingSafeEqual } from 'node:crypto';
import { ApiKeyStatus, ClientApiKeyEntity, ClientAppEntity, ClientAppStatus } from '@app/database';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface AuthenticatedClient {
  clientAppId: string;
  appCode: string;
  apiKeyId: string;
}

export interface HeaderAccessibleRequest {
  header(name: string): string | undefined;
}

@Injectable()
export class ClientAuthService {
  constructor(
    @InjectRepository(ClientApiKeyEntity)
    private readonly clientApiKeyRepository: Repository<ClientApiKeyEntity>,
    @InjectRepository(ClientAppEntity)
    private readonly clientAppRepository: Repository<ClientAppEntity>,
  ) { }

  async authenticate(request: HeaderAccessibleRequest): Promise<AuthenticatedClient> {
    const keyId = request.header('x-api-key');
    const plainSecret = request.header('x-api-secret');

    if (!keyId || !plainSecret) {
      throw new UnauthorizedException('Missing API key headers');
    }

    const apiKey = await this.clientApiKeyRepository.findOne({ where: { keyId } });
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
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

    return {
      clientAppId: clientApp.id,
      appCode: clientApp.appCode,
      apiKeyId: apiKey.id,
    };
  }
}
