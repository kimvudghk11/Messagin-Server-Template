import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ChatParticipantRole, ChatParticipantStatus } from '../../enums/chat.enums';
import { BaseTimeEntity } from '../base';

@Entity('tb_chat_room_participant')
@Unique('uq_tb_chat_room_participant_room_id_user_id', ['roomId', 'userId'])
@Index('idx_tb_chat_room_participant_room_id', ['roomId'])
@Index('idx_tb_chat_room_participant_user_id', ['userId'])
export class ChatRoomParticipantEntity extends BaseTimeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: ChatParticipantRole,
    enumName: 'chat_participant_role',
    default: ChatParticipantRole.MEMBER,
  })
  role!: ChatParticipantRole;

  @Column({
    type: 'enum',
    enum: ChatParticipantStatus,
    enumName: 'chat_participant_status',
    default: ChatParticipantStatus.JOINED,
  })
  status!: ChatParticipantStatus;

  @Column({ name: 'joined_at', type: 'timestamptz', default: () => 'now()' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt!: Date | null;

}
