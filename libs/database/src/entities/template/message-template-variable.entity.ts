import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TemplateVariableDataType } from '../../enums/template.enums';

@Entity('tb_message_template_variable')
@Unique('uq_tb_message_template_variable_template_id_variable_key', ['templateId', 'variableKey'])
@Index('idx_tb_message_template_variable_template_id', ['templateId'])
export class MessageTemplateVariableEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId!: string;

  @Column({ name: 'variable_key', type: 'varchar', length: 120 })
  variableKey!: string;

  @Column({ name: 'variable_name', type: 'varchar', length: 150 })
  variableName!: string;

  @Column({
    name: 'data_type',
    type: 'enum',
    enum: TemplateVariableDataType,
    enumName: 'template_variable_data_type',
    default: TemplateVariableDataType.STRING,
  })
  dataType!: TemplateVariableDataType;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'sample_value', type: 'text', nullable: true })
  sampleValue!: string | null;

  @Column({ name: 'display_order', type: 'integer', default: 1 })
  displayOrder!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
