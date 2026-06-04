import { setupTracing } from '@app/common';

const sdk = setupTracing('worker-sms');

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { WorkerSmsModule } from './worker-sms.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(WorkerSmsModule);
  app.use(helmet());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
