import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { RecipientStatus, RecipientType } from '../../enums/message.enums';

@Entity('tb_message_recipient')
@Index('idx_tb_message_recipient_message_request_id', ['messageRequestId'])
@Index('idx_tb_message_recipient_email', ['email'])
@Index('idx_tb_message_recipient_phone_number', ['phoneNumber'])
export class MessageRecipientEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_request_id', type: 'uuid' })
  messageRequestId!: string;

  @Column({
    name: 'recipient_type',
    type: 'enum',
    enum: RecipientType,
    enumName: 'recipient_type',
    default: RecipientType.TO,
  })
  recipientType!: RecipientType;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'receiver_name', type: 'varchar', length: 120, nullable: true })
  receiverName!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'phone_number', type: 'varchar', length: 30, nullable: true })
  phoneNumber!: string | null;

  @Column({ name: 'kakao_phone_number', type: 'varchar', length: 30, nullable: true })
  kakaoPhoneNumber!: string | null;

  @Column({
    type: 'enum',
    enum: RecipientStatus,
    enumName: 'recipient_status',
    default: RecipientStatus.READY,
  })
  status!: RecipientStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
