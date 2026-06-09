import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ChannelType } from '../../enums/client-auth.enums';
import { BaseCreatedAtEntity } from '../base';

@Entity('tb_message_dlq')
@Index('idx_tb_message_dlq_channel_failed_at', ['channelType', 'failedAt'])
@Index('idx_tb_message_dlq_message_request_id', ['messageRequestId'])
export class MessageDlqEntity extends BaseCreatedAtEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_request_id', type: 'uuid' })
  messageRequestId!: string;

  @Column({ name: 'dispatch_id', type: 'uuid' })
  dispatchId!: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string;

  @Column({
    name: 'channel_type',
    type: 'enum',
    enum: ChannelType,
    enumName: 'channel_type',
  })
  channelType!: ChannelType;

  @Column({ name: 'error_code', type: 'varchar', length: 100 })
  errorCode!: string;

  @Column({ name: 'error_message', type: 'text' })
  errorMessage!: string;

  @Column({ name: 'retry_count', type: 'integer' })
  retryCount!: number;

  @Column({ name: 'original_event', type: 'jsonb' })
  originalEvent!: Record<string, unknown>;

  @Column({ name: 'failed_at', type: 'timestamptz' })
  failedAt!: Date;
}
