import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { DispatchLogStatus, DispatchLogType } from '../../enums/message.enums';

@Entity('tb_message_dispatch_log')
@Index('idx_tb_message_dispatch_log_dispatch_id', ['dispatchId'])
@Index('idx_tb_message_dispatch_log_logged_at', ['loggedAt'])
export class MessageDispatchLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'dispatch_id', type: 'uuid' })
  dispatchId!: string;

  @Column({
    name: 'log_type',
    type: 'enum',
    enum: DispatchLogType,
    enumName: 'dispatch_log_type',
  })
  logType!: DispatchLogType;

  @Column({
    type: 'enum',
    enum: DispatchLogStatus,
    enumName: 'dispatch_log_status',
  })
  status!: DispatchLogStatus;

  @Column({ name: 'provider_code', type: 'varchar', length: 100, nullable: true })
  providerCode!: string | null;

  @Column({ name: 'provider_message', type: 'text', nullable: true })
  providerMessage!: string | null;

  @Column({ name: 'raw_request', type: 'jsonb', nullable: true })
  rawRequest!: Record<string, unknown> | null;

  @Column({ name: 'raw_response', type: 'jsonb', nullable: true })
  rawResponse!: Record<string, unknown> | null;

  @Column({ name: 'logged_at', type: 'timestamptz', default: () => 'now()' })
  loggedAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
