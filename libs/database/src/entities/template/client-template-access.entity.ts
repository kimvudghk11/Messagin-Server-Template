import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseTimeEntity } from '../base';

@Entity('tb_client_template_access')
@Unique('uq_tb_client_template_access_client_app_id_template_id', ['clientAppId', 'templateId'])
@Index('idx_tb_client_template_access_client_app_id', ['clientAppId'])
@Index('idx_tb_client_template_access_template_id', ['templateId'])
export class ClientTemplateAccessEntity extends BaseTimeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_app_id', type: 'uuid' })
  clientAppId!: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId!: string;

  @Column({ name: 'is_allowed', type: 'boolean', default: true })
  isAllowed!: boolean;

}
