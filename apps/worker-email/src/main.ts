import { NestFactory } from '@nestjs/core';
import { WorkerEmailModule } from './worker-email.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerEmailModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
