import { setupTracing } from '@app/common';

const sdk = setupTracing('realtime-chat');

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { RealtimeChatModule } from './realtime-chat.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(RealtimeChatModule);
  app.use(helmet());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors();
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
