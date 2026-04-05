import { NestFactory } from '@nestjs/core';
import { RealtimeChatModule } from './realtime-chat.module';

async function bootstrap() {
  const app = await NestFactory.create(RealtimeChatModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
