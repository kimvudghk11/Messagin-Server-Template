import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ChannelType } from '../../enums/client-auth.enums';
import { ContentFormat, ProviderType, TemplateChannelStatus } from '../../enums/template.enums';

@Entity('tb_message_template_channel')
@Unique('uq_tb_message_template_channel_template_id_channel_type_version', ['templateId', 'channelType', 'version'])
@Index('idx_tb_message_template_channel_template_id', ['templateId'])
@Index('idx_tb_message_template_channel_channel_type', ['channelType'])
export class MessageTemplateChannelEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId!: string;

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

  @Column({ name: 'provider_template_code', type: 'varchar', length: 150, nullable: true })
  providerTemplateCode!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subject!: string | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    name: 'content_format',
    type: 'enum',
    enum: ContentFormat,
    enumName: 'content_format',
    default: ContentFormat.TEXT,
  })
  contentFormat!: ContentFormat;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({
    type: 'enum',
    enum: TemplateChannelStatus,
    enumName: 'template_channel_status',
    default: TemplateChannelStatus.DRAFT,
  })
  status!: TemplateChannelStatus;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
