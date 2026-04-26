import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ChannelType } from '../../enums/client-auth.enums';
import { MessageDispatchStatus } from '../../enums/message.enums';
import { ProviderType } from '../../enums/template.enums';
import { BaseTimeEntity } from '../base';

@Entity('tb_message_dispatch')
@Index('idx_tb_message_dispatch_message_request_id', ['messageRequestId'])
@Index('idx_tb_message_dispatch_recipient_id', ['recipientId'])
@Index('idx_tb_message_dispatch_status', ['status'])
@Index('idx_tb_message_dispatch_channel_type', ['channelType'])
@Index('idx_tb_message_dispatch_next_retry_at', ['nextRetryAt'])
@Index('idx_tb_message_dispatch_created_at', ['createdAt'])
export class MessageDispatchEntity extends BaseTimeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_request_id', type: 'uuid' })
  messageRequestId!: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string;

  @Column({ name: 'template_channel_id', type: 'uuid', nullable: true })
  templateChannelId!: string | null;

  @Column({
    name: 'channel_type',
    type: 'enum',
    enum: ChannelType,
    enumName: 'channel_type',
  })
  channelType!: ChannelType;

  @Column({
    name: 'provider_type',
    type: 'enum',
    enum: ProviderType,
    enumName: 'provider_type',
  })
  providerType!: ProviderType;

  @Column({
    type: 'enum',
    enum: MessageDispatchStatus,
    enumName: 'message_dispatch_status',
    default: MessageDispatchStatus.QUEUED,
  })
  status!: MessageDispatchStatus;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  @Column({ name: 'max_retry_count', type: 'integer', default: 3 })
  maxRetryCount!: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ name: 'last_error_code', type: 'varchar', length: 100, nullable: true })
  lastErrorCode!: string | null;

  @Column({ name: 'last_error_message', type: 'text', nullable: true })
  lastErrorMessage!: string | null;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 150, nullable: true })
  providerMessageId!: string | null;

  @Column({ name: 'queued_at', type: 'timestamptz', nullable: true })
  queuedAt!: Date | null;

  @Column({ name: 'processing_at', type: 'timestamptz', nullable: true })
  processingAt!: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'success_at', type: 'timestamptz', nullable: true })
  successAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt!: Date | null;

}
