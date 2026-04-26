import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TemplateAccessScope, TemplateCategory } from '../../enums/template.enums';

@Entity('tb_message_template')
@Index('idx_tb_message_template_category', ['category'])
export class MessageTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'template_code', type: 'varchar', length: 120, unique: true })
  templateCode!: string;

  @Column({ name: 'template_name', type: 'varchar', length: 150 })
  templateName!: string;

  @Column({
    type: 'enum',
    enum: TemplateCategory,
    enumName: 'template_category',
    default: TemplateCategory.ETC,
  })
  category!: TemplateCategory;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'access_scope',
    type: 'enum',
    enum: TemplateAccessScope,
    enumName: 'template_access_scope',
    default: TemplateAccessScope.PUBLIC,
  })
  accessScope!: TemplateAccessScope;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
