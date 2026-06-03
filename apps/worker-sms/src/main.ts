import { setupTracing } from '@app/common';

const sdk = setupTracing('worker-sms');

import { NestFactory } from '@nestjs/core';
import { WorkerSmsModule } from './worker-sms.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerSmsModule);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
