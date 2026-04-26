import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ClientPermissionType } from '../../enums/client-auth.enums';

@Entity('tb_client_permission')
@Unique('uq_tb_client_permission_client_app_id_permission_type', ['clientAppId', 'permissionType'])
@Index('idx_tb_client_permission_client_app_id', ['clientAppId'])
export class ClientPermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_app_id', type: 'uuid' })
  clientAppId!: string;

  @Column({
    name: 'permission_type',
    type: 'enum',
    enum: ClientPermissionType,
    enumName: 'client_permission_type',
  })
  permissionType!: ClientPermissionType;

  @Column({ name: 'is_allowed', type: 'boolean', default: true })
  isAllowed!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
