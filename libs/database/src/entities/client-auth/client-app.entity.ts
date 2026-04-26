import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AuthMethodType, ClientAppStatus } from '../../enums/client-auth.enums';

@Entity('tb_client_app')
export class ClientAppEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 100, unique: true })
  appCode!: string;

  @Column({ name: 'app_name', type: 'varchar', length: 150 })
  appName!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'owner_name', type: 'varchar', length: 100, nullable: true })
  ownerName!: string | null;

  @Column({ name: 'owner_email', type: 'varchar', length: 255, nullable: true })
  ownerEmail!: string | null;

  @Column({
    type: 'enum',
    enum: ClientAppStatus,
    enumName: 'client_app_status',
    default: ClientAppStatus.ACTIVE,
  })
  status!: ClientAppStatus;

  @Column({
    name: 'auth_method',
    type: 'enum',
    enum: AuthMethodType,
    enumName: 'auth_method_type',
    default: AuthMethodType.API_KEY,
  })
  authMethod!: AuthMethodType;

  @Column({ name: 'is_ip_whitelist_enabled', type: 'boolean', default: false })
  isIpWhitelistEnabled!: boolean;

  @Column({ name: 'rate_limit_per_minute', type: 'integer', default: 60 })
  rateLimitPerMinute!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
