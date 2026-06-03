import { createHash } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApiKeyStatus,
  ApiKeyType,
  ClientApiKeyEntity,
  ClientAppEntity,
  ClientAppStatus,
} from '@app/database';
import { Socket } from 'socket.io';

export interface WsAuthenticatedClient {
  clientAppId: string;
  appCode: string;
  apiKeyId: string;
}

@Injectable()
export class WsAuthService {
  private readonly logger = new Logger(WsAuthService.name);

  constructor(
    @InjectRepository(ClientApiKeyEntity)
    private readonly apiKeyRepository: Repository<ClientApiKeyEntity>,
    @InjectRepository(ClientAppEntity)
    private readonly appRepository: Repository<ClientAppEntity>,
  ) {}

  async authenticate(client: Socket): Promise<WsAuthenticatedClient | null> {
    const headers = client.handshake.headers;
    const keyId = headers['x-api-key'] as string | undefined;
    const secret = headers['x-api-secret'] as string | undefined;

    if (!keyId || !secret) {
      this.logger.warn(`WS connection refused — missing headers: ${client.id}`);
      return null;
    }

    const apiKey = await this.apiKeyRepository.findOne({ where: { keyId } });
    if (!apiKey || apiKey.keyType !== ApiKeyType.SERVER) {
      return null;
    }
    if (apiKey.status !== ApiKeyStatus.ACTIVE) {
      return null;
    }
    if (apiKey.expiredAt && apiKey.expiredAt < new Date()) {
      return null;
    }

    const secretHash = createHash('sha256').update(secret).digest('hex');
    const expectedBuf = Buffer.from(apiKey.secretHash, 'utf-8');
    const actualBuf = Buffer.from(secretHash, 'utf-8');
    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return null;
    }

    const app = await this.appRepository.findOne({
      where: { id: apiKey.clientAppId, status: ClientAppStatus.ACTIVE },
    });
    if (!app) {
      return null;
    }

    return { clientAppId: app.id, appCode: app.appCode, apiKeyId: apiKey.id };
  }
}
