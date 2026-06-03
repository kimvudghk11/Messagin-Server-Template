import { NestFactory } from '@nestjs/core';
import { RealtimeChatModule } from './realtime-chat.module';

async function bootstrap() {
  const app = await NestFactory.create(RealtimeChatModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
