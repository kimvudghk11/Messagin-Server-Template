import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('tb_client_ip_whitelist')
@Unique('uq_tb_client_ip_whitelist_client_app_id_ip_address', ['clientAppId', 'ipAddress'])
@Index('idx_tb_client_ip_whitelist_client_app_id', ['clientAppId'])
export class ClientIpWhitelistEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_app_id', type: 'uuid' })
  clientAppId!: string;

  @Column({ name: 'ip_address', type: 'cidr' })
  ipAddress!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
