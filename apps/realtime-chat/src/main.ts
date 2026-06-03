import { setupTracing } from '@app/common';

const sdk = setupTracing('realtime-chat');

import { NestFactory } from '@nestjs/core';
import { RealtimeChatModule } from './realtime-chat.module';

async function bootstrap() {
  const app = await NestFactory.create(RealtimeChatModule);
  app.enableCors();
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
