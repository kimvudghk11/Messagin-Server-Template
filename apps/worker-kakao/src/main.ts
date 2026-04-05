import { NestFactory } from '@nestjs/core';
import { WorkerKakaoModule } from './worker-kakao.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerKakaoModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
