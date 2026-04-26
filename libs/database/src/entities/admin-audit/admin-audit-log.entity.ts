import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AdminActionType, AdminTargetType } from '../../enums/admin-audit.enums';

@Entity('tb_admin_audit_log')
@Index('idx_tb_admin_audit_log_admin_user_id', ['adminUserId'])
@Index('idx_tb_admin_audit_log_target_type_target_id', ['targetType', 'targetId'])
export class AdminAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'admin_user_id', type: 'uuid' })
  adminUserId!: string;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: AdminActionType,
    enumName: 'admin_action_type',
  })
  actionType!: AdminActionType;

  @Column({
    name: 'target_type',
    type: 'enum',
    enum: AdminTargetType,
    enumName: 'admin_target_type',
  })
  targetType!: AdminTargetType;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId!: string | null;

  @Column({ name: 'before_data', type: 'jsonb', nullable: true })
  beforeData!: Record<string, unknown> | null;

  @Column({ name: 'after_data', type: 'jsonb', nullable: true })
  afterData!: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
