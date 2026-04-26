import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseCreatedAtEntity } from '../base';

@Entity('tb_chat_attachment')
export class ChatAttachmentEntity extends BaseCreatedAtEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

}
