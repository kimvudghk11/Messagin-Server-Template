import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ChatMessageStatus, ChatMessageType } from '../../enums/chat.enums';
import { BaseTimeEntity } from '../base';

@Entity('tb_chat_message')
@Index('idx_tb_chat_message_room_id_sent_at', ['roomId', 'sentAt'])
export class ChatMessageEntity extends BaseTimeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId!: string;

  @Column({ name: 'sender_user_id', type: 'uuid' })
  senderUserId!: string;

  @Column({
    name: 'message_type',
    type: 'enum',
    enum: ChatMessageType,
    enumName: 'chat_message_type',
    default: ChatMessageType.TEXT,
  })
  messageType!: ChatMessageType;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: ChatMessageStatus,
    enumName: 'chat_message_status',
    default: ChatMessageStatus.SENT,
  })
  status!: ChatMessageStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', default: () => 'now()' })
  sentAt!: Date;

}
