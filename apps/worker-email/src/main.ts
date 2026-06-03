import { setupTracing } from '@app/common';

const sdk = setupTracing('worker-email');

import { NestFactory } from '@nestjs/core';
import { WorkerEmailModule } from './worker-email.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerEmailModule);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
