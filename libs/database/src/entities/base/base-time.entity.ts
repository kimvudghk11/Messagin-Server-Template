import { UpdateDateColumn } from 'typeorm';
import { BaseCreatedAtEntity } from './base-created-at.entity';

export abstract class BaseTimeEntity extends BaseCreatedAtEntity {
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
