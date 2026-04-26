import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  ChannelGroupType,
  MessagePriority,
  MessageRequestStatus,
  MessageType,
} from '../../enums/message.enums';
import { BaseTimeEntity } from '../base';

@Entity('tb_message_request')
@Index('idx_tb_message_request_client_app_id', ['clientAppId'])
@Index('idx_tb_message_request_status', ['status'])
@Index('idx_tb_message_request_requested_at', ['requestedAt'])
@Index('idx_tb_message_request_template_code', ['templateCode'])
export class MessageRequestEntity extends BaseTimeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'request_id', type: 'varchar', length: 150, unique: true })
  requestId!: string;

  @Column({ name: 'client_app_id', type: 'uuid' })
  clientAppId!: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId!: string | null;

  @Column({ name: 'template_code', type: 'varchar', length: 120, nullable: true })
  templateCode!: string | null;

  @Column({
    name: 'message_type',
    type: 'enum',
    enum: MessageType,
    enumName: 'message_type',
    default: MessageType.TEMPLATE,
  })
  messageType!: MessageType;

  @Column({
    name: 'channel_group_type',
    type: 'enum',
    enum: ChannelGroupType,
    enumName: 'channel_group_type',
    default: ChannelGroupType.SINGLE,
  })
  channelGroupType!: ChannelGroupType;

  @Column({ name: 'requested_by_user_id', type: 'uuid', nullable: true })
  requestedByUserId!: string | null;

  @Column({ name: 'requested_by_system', type: 'varchar', length: 120, nullable: true })
  requestedBySystem!: string | null;

  @Column({
    type: 'enum',
    enum: MessagePriority,
    enumName: 'message_priority',
    default: MessagePriority.NORMAL,
  })
  priority!: MessagePriority;

  @Column({
    type: 'enum',
    enum: MessageRequestStatus,
    enumName: 'message_request_status',
    default: MessageRequestStatus.RECEIVED,
  })
  status!: MessageRequestStatus;

  @Column({ name: 'callback_url', type: 'text', nullable: true })
  callbackUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: 'requested_at', type: 'timestamptz', default: () => 'now()' })
  requestedAt!: Date;

  @Column({ name: 'validated_at', type: 'timestamptz', nullable: true })
  validatedAt!: Date | null;

  @Column({ name: 'queued_at', type: 'timestamptz', nullable: true })
  queuedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt!: Date | null;

}
