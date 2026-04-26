import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiKeyStatus, ApiKeyType } from '../../enums/client-auth.enums';
import { BaseTimeEntity } from '../base';

@Entity('tb_client_api_key')
@Index('idx_tb_client_api_key_client_app_id', ['clientAppId'])
export class ClientApiKeyEntity extends BaseTimeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_app_id', type: 'uuid' })
  clientAppId!: string;

  @Column({ name: 'key_id', type: 'varchar', length: 120, unique: true })
  keyId!: string;

  @Column({ name: 'key_name', type: 'varchar', length: 120 })
  keyName!: string;

  @Column({
    name: 'key_type',
    type: 'enum',
    enum: ApiKeyType,
    enumName: 'api_key_type',
    default: ApiKeyType.SERVER,
  })
  keyType!: ApiKeyType;

  @Column({ name: 'secret_hash', type: 'text' })
  secretHash!: string;

  @Column({ name: 'secret_hint', type: 'varchar', length: 20, nullable: true })
  secretHint!: string | null;

  @Column({
    type: 'enum',
    enum: ApiKeyStatus,
    enumName: 'api_key_status',
    default: ApiKeyStatus.ACTIVE,
  })
  status!: ApiKeyStatus;

  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'now()' })
  issuedAt!: Date;

  @Column({ name: 'expired_at', type: 'timestamptz', nullable: true })
  expiredAt!: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

}
