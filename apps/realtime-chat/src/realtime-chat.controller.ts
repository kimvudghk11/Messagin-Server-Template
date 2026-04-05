import { Controller, Get } from '@nestjs/common';
import { RealtimeChatService } from './realtime-chat.service';

@Controller()
export class RealtimeChatController {
  constructor(private readonly realtimeChatService: RealtimeChatService) {}

  @Get()
  getHello(): string {
    return this.realtimeChatService.getHello();
  }
}
