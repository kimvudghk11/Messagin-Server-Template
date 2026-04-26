import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ApiKeyStatus,
  ApiKeyType,
  ClientApiKeyEntity,
  ClientAppEntity,
} from '@app/database';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { ApiKeyEnvironment, CreateClientApiKeyDto } from './dto/create-client-api-key.dto';

@Injectable()
export class ClientApiKeyService {
  constructor(
    @InjectRepository(ClientAppEntity)
    private readonly clientAppRepository: Repository<ClientAppEntity>,
    @InjectRepository(ClientApiKeyEntity)
    private readonly clientApiKeyRepository: Repository<ClientApiKeyEntity>,
  ) { }

  async create(clientAppId: string, dto: CreateClientApiKeyDto) {
    const clientApp = await this.clientAppRepository.findOne({ where: { id: clientAppId } });
    if (!clientApp) {
      throw new NotFoundException('Client app not found');
    }

    const environment = dto.environment ?? ApiKeyEnvironment.TEST;
    const keyPrefix = environment === ApiKeyEnvironment.LIVE ? 'mst_live_' : 'mst_test_';

    const keyId = `${keyPrefix}${randomBytes(16).toString('hex')}`;
    const plainSecret = randomBytes(32).toString('hex');
    const secretHash = createHash('sha256').update(plainSecret).digest('hex');
    const secretHint = plainSecret.slice(-4);

    const entity = this.clientApiKeyRepository.create({
      clientAppId,
      keyId,
      keyName: dto.keyName,
      keyType: dto.keyType ?? ApiKeyType.SERVER,
      secretHash,
      secretHint,
      status: ApiKeyStatus.ACTIVE,
      issuedAt: new Date(),
      expiredAt: dto.expiredAt ? new Date(dto.expiredAt) : null,
      lastUsedAt: null,
    });

    const saved = await this.clientApiKeyRepository.save(entity);

    return {
      id: saved.id,
      clientAppId: saved.clientAppId,
      keyId: saved.keyId,
      keyName: saved.keyName,
      keyType: saved.keyType,
      status: saved.status,
      secretHint: saved.secretHint,
      issuedAt: saved.issuedAt,
      expiredAt: saved.expiredAt,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      plainSecret,
    };
  }
}
