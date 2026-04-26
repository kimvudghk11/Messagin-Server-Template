import { CreateDateColumn } from 'typeorm';

export abstract class BaseCreatedAtEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
