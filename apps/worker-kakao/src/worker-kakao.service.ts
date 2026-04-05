import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkerKakaoService {
  getHello(): string {
    return 'Hello World!';
  }
}
