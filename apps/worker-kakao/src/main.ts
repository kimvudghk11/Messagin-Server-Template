import { setupTracing } from '@app/common';

const sdk = setupTracing('worker-kakao');

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { WorkerKakaoModule } from './worker-kakao.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(WorkerKakaoModule);
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
