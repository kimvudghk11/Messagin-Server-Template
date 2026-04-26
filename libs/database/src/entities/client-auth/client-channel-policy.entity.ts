import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ChannelType } from '../../enums/client-auth.enums';

@Entity('tb_client_channel_policy')
@Unique('uq_tb_client_channel_policy_client_app_id_channel_type', ['clientAppId', 'channelType'])
@Index('idx_tb_client_channel_policy_client_app_id', ['clientAppId'])
export class ClientChannelPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_app_id', type: 'uuid' })
  clientAppId!: string;

  @Column({
    name: 'channel_type',
    type: 'enum',
    enum: ChannelType,
    enumName: 'channel_type',
  })
  channelType!: ChannelType;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  @Column({ name: 'daily_limit', type: 'integer', nullable: true })
  dailyLimit!: number | null;

  @Column({ name: 'monthly_limit', type: 'integer', nullable: true })
  monthlyLimit!: number | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
