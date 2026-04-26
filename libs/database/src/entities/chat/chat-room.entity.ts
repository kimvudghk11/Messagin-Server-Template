import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ChatRoomStatus, ChatRoomType } from '../../enums/chat.enums';
import { BaseTimeEntity } from '../base';

@Entity('tb_chat_room')
@Index('idx_tb_chat_room_status', ['status'])
export class ChatRoomEntity extends BaseTimeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'room_code', type: 'varchar', length: 120, unique: true })
  roomCode!: string;

  @Column({ name: 'room_name', type: 'varchar', length: 150, nullable: true })
  roomName!: string | null;

  @Column({
    name: 'room_type',
    type: 'enum',
    enum: ChatRoomType,
    enumName: 'chat_room_type',
    default: ChatRoomType.DIRECT,
  })
  roomType!: ChatRoomType;

  @Column({
    type: 'enum',
    enum: ChatRoomStatus,
    enumName: 'chat_room_status',
    default: ChatRoomStatus.ACTIVE,
  })
  status!: ChatRoomStatus;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

}
