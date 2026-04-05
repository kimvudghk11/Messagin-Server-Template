import { Injectable } from '@nestjs/common';

@Injectable()
export class RealtimeChatService {
  getHello(): string {
    return 'Hello World!';
  }
}
