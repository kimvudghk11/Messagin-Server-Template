import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { OutboxAggregateType, OutboxEventType, OutboxStatus } from '../../enums/outbox-event.enums';

@Entity('tb_message_outbox')
@Index('idx_tb_message_outbox_status_created_at', ['status', 'createdAt'])
export class MessageOutboxEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'aggregate_type',
    type: 'enum',
    enum: OutboxAggregateType,
    enumName: 'outbox_aggregate_type',
  })
  aggregateType!: OutboxAggregateType;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId!: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: OutboxEventType,
    enumName: 'outbox_event_type',
  })
  eventType!: OutboxEventType;

  @Column({ name: 'event_key', type: 'varchar', length: 150 })
  eventKey!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: OutboxStatus,
    enumName: 'outbox_status',
    default: OutboxStatus.PENDING,
  })
  status!: OutboxStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
