import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageDlqEntity } from '@app/database';

@Injectable()
export class DlqService {
  constructor(
    @InjectRepository(MessageDlqEntity)
    private readonly dlqRepository: Repository<MessageDlqEntity>,
  ) {}

  async findAll(
    page: number,
    limit: number,
  ): Promise<{ data: MessageDlqEntity[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.dlqRepository.findAndCount({
      order: { failedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }
}
