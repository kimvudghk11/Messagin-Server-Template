import { NestFactory } from '@nestjs/core';
import { WorkerEmailModule } from './worker-email.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerEmailModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
