import { NestFactory } from '@nestjs/core';
import { WorkerKakaoModule } from './worker-kakao.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerKakaoModule);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
