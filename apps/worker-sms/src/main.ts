import { NestFactory } from '@nestjs/core';
import { WorkerSmsModule } from './worker-sms.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerSmsModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
