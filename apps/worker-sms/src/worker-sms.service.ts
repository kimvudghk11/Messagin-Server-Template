import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkerSmsService {
  getHello(): string {
    return 'Hello World!';
  }
}
