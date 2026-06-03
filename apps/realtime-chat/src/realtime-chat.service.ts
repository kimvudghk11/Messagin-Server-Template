import { Injectable } from '@nestjs/common';

@Injectable()
export class RealtimeChatService {
  health(): { status: string } {
    return { status: 'ok' };
  }
}
