import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseCreatedAtEntity } from '../base';

@Entity('tb_chat_message_read')
@Unique('uq_tb_chat_message_read_message_id_user_id', ['messageId', 'userId'])
@Index('idx_tb_chat_message_read_message_id', ['messageId'])
export class ChatMessageReadEntity extends BaseCreatedAtEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'read_at', type: 'timestamptz', default: () => 'now()' })
  readAt!: Date;

}
