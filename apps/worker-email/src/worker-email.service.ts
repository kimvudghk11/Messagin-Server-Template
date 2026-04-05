import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkerEmailService {
  getHello(): string {
    return 'Hello World!';
  }
}
