import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PayloadEncryptionStatus } from '../../enums/message.enums';
import { BaseCreatedAtEntity } from '../base';

@Entity('tb_message_payload')
@Index('idx_tb_message_payload_message_request_id', ['messageRequestId'])
export class MessagePayloadEntity extends BaseCreatedAtEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_request_id', type: 'uuid', unique: true })
  messageRequestId!: string;

  @Column({ name: 'payload_json', type: 'jsonb' })
  payloadJson!: Record<string, unknown>;

  @Column({ name: 'masked_payload_json', type: 'jsonb', nullable: true })
  maskedPayloadJson!: Record<string, unknown> | null;

  @Column({
    name: 'encryption_status',
    type: 'enum',
    enum: PayloadEncryptionStatus,
    enumName: 'payload_encryption_status',
    default: PayloadEncryptionStatus.PLAIN,
  })
  encryptionStatus!: PayloadEncryptionStatus;

}
