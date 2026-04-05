import { NestFactory } from '@nestjs/core';
import { WorkerSmsModule } from './worker-sms.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerSmsModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
